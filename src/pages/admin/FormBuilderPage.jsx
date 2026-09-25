import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QuestionEditor, { questionProblem } from "../../components/forms/QuestionEditor";
import { supabase } from "../../services/supabase";
import {
  AI_PROMPT,
  BLOCK_TYPES,
  FORM_TYPES,
  RELEASE_MODES,
  canHavePoints,
  hasOptions,
  isQuestion,
  slugify,
  uploadFormImage,
} from "../../services/forms";
import { emptyBlock, parseImport } from "../../services/formsImport";
import "../../styles/forms-admin.css";

const norm = (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const toLocalInput = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const numberOrNull = (value) => {
  const text = String(value ?? "").trim().replace(",", ".");
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const EMPTY_FORM = {
  title: "", slug: "", description: "", type: "exam", status: "draft",
  audience: "students", product_id: "", max_attempts: "", time_limit_minutes: "", pass_score: "",
  release_mode: "manual", release_at: "", shuffle_questions: false, shuffle_options: false,
  require_name: true, require_email: false, show_score: false, show_key: true, key_after_last_attempt: false,
  starts_at: "", ends_at: "",
};

// linhas do banco -> modelo do editor
function blockFromRows(row, key) {
  const options = Array.isArray(row.options) ? row.options : [];
  const correct = key?.correct;
  const block = {
    ...emptyBlock(row.type),
    id: row.id,
    isNew: false,
    title: row.title || "",
    description: row.description || "",
    image_url: row.image_url || "",
    required: Boolean(row.required),
    points: Number(row.points) || 0,
    topic: row.topic || "",
    options: hasOptions(row.type) ? options : [],
    tolerance: key?.tolerance ?? "",
    partial_credit: Boolean(key?.partial_credit),
    annulled: Boolean(key?.annulled),
    feedback: key?.feedback || "",
    feedback_image_url: key?.feedback_image_url || "",
  };
  if (correct === null || correct === undefined) return block;
  if (row.type === "choice") block.correct_idx = options.findIndex((option) => norm(option) === norm(correct));
  else if (row.type === "multi_choice") block.correct_set = (Array.isArray(correct) ? correct : [correct]).map((c) => options.findIndex((option) => norm(option) === norm(c))).filter((i) => i >= 0);
  else if (row.type === "true_false" || row.type === "yes_no") block.tf = String(correct);
  else if (row.type === "short_text") block.accepted_text = (Array.isArray(correct) ? correct : [correct]).join("\n");
  else if (row.type === "number") block.number_value = String(correct);
  return block;
}

// modelo do editor -> gabarito
function keyFromBlock(block) {
  let correct = null;
  const options = block.options.map((option) => option.trim());
  if (block.type === "choice" && block.correct_idx >= 0) correct = options[block.correct_idx] || null;
  else if (block.type === "multi_choice" && block.correct_set.length) correct = [...block.correct_set].sort((a, b) => a - b).map((i) => options[i]).filter(Boolean);
  else if ((block.type === "true_false" || block.type === "yes_no") && block.tf) correct = block.tf;
  else if (block.type === "short_text") {
    const lines = block.accepted_text.split("\n").map((line) => line.trim()).filter(Boolean);
    correct = lines.length > 1 ? lines : lines[0] || null;
  } else if (block.type === "number") correct = numberOrNull(block.number_value);
  return {
    block_id: block.id,
    correct,
    tolerance: block.type === "number" ? numberOrNull(block.tolerance) : null,
    partial_credit: block.type === "multi_choice" ? Boolean(block.partial_credit) : false,
    annulled: Boolean(block.annulled),
    feedback: block.feedback.trim() || null,
    feedback_image_url: block.feedback_image_url || null,
  };
}

export default function FormBuilderPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [blocks, setBlocks] = useState([]);
  const [products, setProducts] = useState([]);
  const [serverIds, setServerIds] = useState([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [openIds, setOpenIds] = useState({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [newType, setNewType] = useState("choice");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  useEffect(() => {
    supabase.from("products").select("id,title").order("title").then(({ data }) => setProducts(data || []));
  }, []);

  useEffect(() => {
    if (!editing) return;
    const load = async () => {
      const [{ data: row, error: formError }, { data: rows, error: blocksError }, { count }] = await Promise.all([
        supabase.from("forms").select("*").eq("id", id).single(),
        supabase.from("form_blocks").select("*").eq("form_id", id).order("position"),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("form_id", id).neq("status", "in_progress"),
      ]);
      if (formError || blocksError) {
        notify("error", formError?.message || blocksError?.message);
        setLoading(false);
        return;
      }
      const ids = (rows || []).map((item) => item.id);
      const { data: keys } = ids.length ? await supabase.from("form_block_keys").select("*").in("block_id", ids) : { data: [] };
      const keyById = Object.fromEntries((keys || []).map((key) => [key.block_id, key]));
      const settings = row.settings || {};
      setForm({
        title: row.title || "", slug: row.slug || "", description: row.description || "", type: row.type || "exam", status: row.status || "draft",
        audience: row.audience || "public", product_id: row.product_id || "",
        max_attempts: row.max_attempts ?? "", time_limit_minutes: row.time_limit_minutes ?? "", pass_score: row.pass_score ?? "",
        release_mode: row.release_mode || "immediate", release_at: toLocalInput(row.release_at),
        shuffle_questions: Boolean(row.shuffle_questions), shuffle_options: Boolean(row.shuffle_options),
        require_name: settings.require_name !== false, require_email: Boolean(settings.require_email), show_score: Boolean(settings.show_score),
        show_key: settings.show_key !== false, key_after_last_attempt: Boolean(settings.key_after_last_attempt),
        starts_at: toLocalInput(row.starts_at), ends_at: toLocalInput(row.ends_at),
      });
      setBlocks((rows || []).map((item) => blockFromRows(item, keyById[item.id])));
      setServerIds(ids);
      setSubmissionCount(count || 0);
      setLoading(false);
    };
    load();
  }, [editing, id]);

  const update = (key, value) =>
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !editing) next.slug = slugify(value);
      return next;
    });

  const students = form.audience === "students";
  const updateBlock = (blockId, patch) => setBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  const addBlock = () => {
    const block = emptyBlock(newType);
    if (!canHavePoints(newType)) block.points = 0;
    if (!isQuestion(newType)) block.required = false;
    setBlocks((current) => [...current, block]);
    setOpenIds((current) => ({ ...current, [block.id]: true }));
  };
  const removeBlock = (blockId) => {
    if (!window.confirm("Excluir esta pergunta?")) return;
    setBlocks((current) => current.filter((block) => block.id !== blockId));
  };
  const duplicateBlock = (blockId) =>
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId);
      const copy = { ...current[index], id: crypto.randomUUID(), isNew: true, options: [...current[index].options], correct_set: [...current[index].correct_set] };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      setOpenIds((open) => ({ ...open, [copy.id]: true }));
      return next;
    });
  const moveBlock = (blockId, dir) =>
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId);
      const target = index + dir;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const uploadImage = async (blockId, file, field) => {
    if (!file) return;
    try {
      updateBlock(blockId, { [field]: await uploadFormImage(file) });
    } catch (error) {
      notify("error", error.message);
    }
  };

  const doImport = () => {
    try {
      const { blocks: imported, withoutAnswer } = parseImport(importText);
      setBlocks((current) => [...current, ...imported]);
      setImportText("");
      setShowImport(false);
      notify(withoutAnswer ? "info" : "success", `${imported.length} pergunta(s) importada(s).${withoutAnswer ? ` ${withoutAnswer} ficou sem resposta correta marcada: confira as que estão sinalizadas.` : " Revise e salve."}`);
    } catch (error) {
      notify("error", error.message);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      notify("success", "Instruções copiadas. Cole na IA, troque os trechos entre colchetes e traga as perguntas aqui em Importar.");
    } catch {
      window.prompt("Copie as instruções:", AI_PROMPT);
    }
  };

  const totalPoints = useMemo(() => blocks.reduce((sum, block) => sum + (canHavePoints(block.type) ? Number(block.points) || 0 : 0), 0), [blocks]);
  const questionCount = blocks.filter((block) => isQuestion(block.type)).length;
  const publicLink = `${window.location.origin}/f/${form.slug || slugify(form.title)}`;

  const save = async (publish = false) => {
    setMessage("");
    const problems = blocks.map((block, index) => ({ index, text: questionProblem(block) })).filter((item) => item.text);
    if (!form.title.trim()) return notify("error", "Informe o título.");
    if (!slugify(form.slug || form.title)) return notify("error", "Informe um endereço válido para o link.");
    if (problems.length && publish) {
      setOpenIds((current) => ({ ...current, ...Object.fromEntries(problems.map((item) => [blocks[item.index].id, true])) }));
      return notify("error", `Antes de publicar, corrija a pergunta ${problems[0].index + 1}: ${problems[0].text}`);
    }
    if (publish && questionCount === 0) return notify("error", "Adicione ao menos uma pergunta antes de publicar.");
    if (students && form.release_mode === "date" && !form.release_at) return notify("error", "Escolha a data em que a nota será liberada.");

    const currentIds = blocks.map((block) => block.id);
    const removed = serverIds.filter((blockId) => !currentIds.includes(blockId));
    if (removed.length && submissionCount > 0 && !window.confirm(`Você removeu ${removed.length} pergunta(s). As respostas já enviadas a elas serão apagadas. Continuar?`)) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        description: form.description.trim() || null,
        type: form.type,
        status: publish ? "published" : form.status,
        audience: form.audience,
        product_id: students && form.product_id ? form.product_id : null,
        max_attempts: students ? numberOrNull(form.max_attempts) : null,
        time_limit_minutes: students ? numberOrNull(form.time_limit_minutes) : null,
        pass_score: students ? numberOrNull(form.pass_score) : null,
        release_mode: students ? form.release_mode : "immediate",
        release_at: students && form.release_mode === "date" && form.release_at ? new Date(form.release_at).toISOString() : null,
        shuffle_questions: students && form.shuffle_questions,
        shuffle_options: students && form.shuffle_options,
        settings: {
          require_name: Boolean(form.require_name),
          require_email: Boolean(form.require_email),
          show_score: Boolean(form.show_score),
          show_key: Boolean(form.show_key),
          key_after_last_attempt: Boolean(form.key_after_last_attempt),
        },
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };

      let formId = id;
      if (editing) {
        const { error } = await supabase.from("forms").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("forms").insert(payload).select("id").single();
        if (error) throw error;
        formId = data.id;
      }

      const rows = blocks.map((block, index) => ({
        id: block.id,
        form_id: formId,
        type: block.type,
        title: block.title.trim() || null,
        description: block.description.trim() || null,
        image_url: block.image_url || null,
        options: hasOptions(block.type) ? block.options.map((option) => option.trim()).filter(Boolean) : block.type === "true_false" ? ["Verdadeiro", "Falso"] : block.type === "yes_no" ? ["Sim", "Não"] : [],
        required: isQuestion(block.type) && Boolean(block.required),
        points: canHavePoints(block.type) ? Number(block.points) || 0 : 0,
        position: index,
        topic: block.topic.trim() || null,
        correct_answer: null,
      }));
      if (rows.length) {
        const { error } = await supabase.from("form_blocks").upsert(rows, { onConflict: "id" });
        if (error) throw error;
      }
      if (removed.length) {
        const { error } = await supabase.from("form_blocks").delete().in("id", removed);
        if (error) throw error;
      }
      const keys = blocks.filter((block) => isQuestion(block.type)).map(keyFromBlock);
      if (keys.length) {
        const { error } = await supabase.from("form_block_keys").upsert(keys, { onConflict: "block_id" });
        if (error) throw error;
      }

      setServerIds(currentIds);
      setBlocks((current) => current.map((block) => ({ ...block, isNew: false })));
      setForm((current) => ({ ...current, status: payload.status }));
      notify(
        "success",
        `${publish ? "Publicado." : "Salvo."}${submissionCount > 0 ? " Se você mudou gabaritos ou pontos, use “Recalcular notas” em Resultados para atualizar as notas já enviadas." : ""}`
      );
      if (!editing) navigate(`/admin/formularios/${formId}`, { replace: true });
    } catch (error) {
      const text = String(error.message || "");
      notify("error", /form_block_keys|correct|audience|does not exist/i.test(text) ? "O banco ainda não tem a atualização de provas (SQL 21). Rode o arquivo supabase/21_provas_e_atividades.sql no Supabase." : text || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="admin-section">Carregando...</section>;

  let number = 0;
  return (
    <section className="admin-section fa">
      <div className="fa-top">
        <div>
          <h2>{editing ? "Editar" : "Nova prova ou atividade"}</h2>
          <p className="fa-sub">{questionCount} {questionCount === 1 ? "pergunta" : "perguntas"}{totalPoints > 0 ? ` · ${totalPoints} pontos` : ""} · {form.status === "published" ? "Publicado" : form.status === "draft" ? "Rascunho" : form.status === "closed" ? "Encerrado" : "Arquivado"}</p>
        </div>
        <div className="fa-top-actions">
          <button className="fa-btn is-ghost" type="button" onClick={() => navigate("/admin/formularios")}>Voltar</button>
          <button className="fa-btn is-ghost" type="button" disabled={saving} onClick={() => save(false)}>Salvar rascunho</button>
          <button className="fa-btn" type="button" disabled={saving} onClick={() => save(true)}>{saving ? "Salvando..." : form.status === "published" ? "Salvar e manter publicado" : "Publicar"}</button>
        </div>
      </div>

      {message && <div className={`fa-alert is-${messageType}`} role="status">{message}</div>}

      <div className="fa-card">
        <h3>Informações</h3>
        <div className="fa-grid">
          <label className="fa-field fa-wide"><span>Título</span><input className="fa-input" value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
          <label className="fa-field fa-wide"><span>Instruções para quem vai responder (opcional)</span><textarea className="fa-input" rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
          <label className="fa-field">
            <span>Tipo</span>
            <select className="fa-input" value={form.type} onChange={(e) => update("type", e.target.value)}>{FORM_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label className="fa-field">
            <span>Situação</span>
            <select className="fa-input" value={form.status} onChange={(e) => update("status", e.target.value)}>
              <option value="draft">Rascunho (ninguém vê)</option>
              <option value="published">Publicado</option>
              <option value="closed">Encerrado</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <label className="fa-field fa-wide">
            <span>Endereço do link</span>
            <input className="fa-input" value={form.slug} onChange={(e) => update("slug", e.target.value)} />
            <small>{students ? `Os alunos abrem em Atividades, ou por ${publicLink} depois de entrar.` : publicLink}</small>
          </label>
        </div>
      </div>

      <div className="fa-card">
        <h3>Quem responde e como</h3>
        <div className="fa-seg is-wide" role="radiogroup" aria-label="Quem pode responder">
          <button type="button" role="radio" aria-checked={students} className={students ? "is-active" : ""} onClick={() => update("audience", "students")}>Só alunos logados</button>
          <button type="button" role="radio" aria-checked={!students} className={!students ? "is-active" : ""} onClick={() => update("audience", "public")}>Qualquer pessoa com o link</button>
        </div>

        {students ? (
          <div className="fa-grid">
            <label className="fa-field">
              <span>Para quem</span>
              <select className="fa-input" value={form.product_id} onChange={(e) => update("product_id", e.target.value)}>
                <option value="">Todos os alunos</option>
                {products.map((product) => <option key={product.id} value={product.id}>Só quem tem acesso a: {product.title}</option>)}
              </select>
            </label>
            <label className="fa-field"><span>Tentativas permitidas</span><input className="fa-input" type="number" min="1" value={form.max_attempts} onChange={(e) => update("max_attempts", e.target.value)} placeholder="Em branco = ilimitadas" /></label>
            <label className="fa-field"><span>Tempo de prova (minutos)</span><input className="fa-input" type="number" min="1" value={form.time_limit_minutes} onChange={(e) => update("time_limit_minutes", e.target.value)} placeholder="Em branco = sem limite" /></label>
            <label className="fa-field"><span>Nota mínima para aprovação (%)</span><input className="fa-input" type="number" min="0" max="100" value={form.pass_score} onChange={(e) => update("pass_score", e.target.value)} placeholder="Em branco = sem aprovação" /></label>
            <label className="fa-field"><span>Abre em (opcional)</span><input className="fa-input" type="datetime-local" value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} /></label>
            <label className="fa-field"><span>Encerra em (opcional)</span><input className="fa-input" type="datetime-local" value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} /></label>
            <div className="fa-field fa-wide fa-checks">
              <label className="fa-check"><input type="checkbox" checked={form.shuffle_questions} onChange={(e) => update("shuffle_questions", e.target.checked)} /> Embaralhar a ordem das perguntas</label>
              <label className="fa-check"><input type="checkbox" checked={form.shuffle_options} onChange={(e) => update("shuffle_options", e.target.checked)} /> Embaralhar as alternativas</label>
            </div>
          </div>
        ) : (
          <div className="fa-grid">
            <div className="fa-field fa-wide fa-checks">
              <label className="fa-check"><input type="checkbox" checked={form.require_name} onChange={(e) => update("require_name", e.target.checked)} /> Pedir o nome</label>
              <label className="fa-check"><input type="checkbox" checked={form.require_email} onChange={(e) => update("require_email", e.target.checked)} /> Pedir o e-mail</label>
              <label className="fa-check"><input type="checkbox" checked={form.show_score} onChange={(e) => update("show_score", e.target.checked)} /> Mostrar a nota ao terminar</label>
            </div>
            <label className="fa-field"><span>Abre em (opcional)</span><input className="fa-input" type="datetime-local" value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} /></label>
            <label className="fa-field"><span>Encerra em (opcional)</span><input className="fa-input" type="datetime-local" value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} /></label>
            <p className="fa-note fa-wide">Tempo de prova, tentativas, nota mínima e liberação da nota só funcionam para alunos logados, porque precisamos saber quem é a pessoa.</p>
          </div>
        )}
      </div>

      {students && (
        <div className="fa-card">
          <h3>Nota e comentários para o aluno</h3>
          <div className="fa-radios" role="radiogroup" aria-label="Quando liberar a nota">
            {RELEASE_MODES.map(([value, label]) => (
              <label key={value} className={form.release_mode === value ? "is-checked" : ""}>
                <input type="radio" name="release" checked={form.release_mode === value} onChange={() => update("release_mode", value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {form.release_mode === "date" && (
            <label className="fa-field" style={{ maxWidth: 320 }}><span>Liberar em</span><input className="fa-input" type="datetime-local" value={form.release_at} onChange={(e) => update("release_at", e.target.value)} /></label>
          )}
          <p className="fa-help">
            Até liberar, o aluno só vê que a prova foi enviada. Se houver discursivas ou arquivos, a nota só fica completa depois que você corrigir em Resultados.
          </p>
          <div className="fa-checks">
            <label className="fa-check"><input type="checkbox" checked={form.show_key} onChange={(e) => update("show_key", e.target.checked)} /> Mostrar o gabarito e os comentários das questões depois da liberação</label>
            {form.show_key && (
              <label className="fa-check"><input type="checkbox" checked={form.key_after_last_attempt} onChange={(e) => update("key_after_last_attempt", e.target.checked)} /> Só mostrar o gabarito quando o aluno usar todas as tentativas</label>
            )}
          </div>
        </div>
      )}

      <div className="fa-card">
        <div className="fa-card-head">
          <h3>Perguntas</h3>
          <div className="fa-tools">
            <button type="button" className="fa-btn is-ghost is-small" onClick={() => setShowImport((v) => !v)}>{showImport ? "Fechar importação" : "Importar várias de uma vez"}</button>
            <button type="button" className="fa-btn is-ghost is-small" onClick={() => setOpenIds(Object.fromEntries(blocks.map((block) => [block.id, !Object.values(openIds).some(Boolean)])))}>
              {Object.values(openIds).some(Boolean) ? "Recolher todas" : "Abrir todas"}
            </button>
          </div>
        </div>

        {showImport && (
          <div className="fa-import">
            <p>
              Peça a uma IA para escrever as questões comentadas neste formato, cole aqui e importe. Sem a linha PONTOS, cada questão vale 1. Também aceita JSON.{" "}
              <button type="button" className="fa-link-btn" onClick={copyPrompt}>Copiar instruções para a IA</button>
            </p>
            <pre>{`### MÓDULO: Biossegurança e Avaliação da Cena

QUESTÃO 1
Antes de tocar em qualquer vítima, a primeira atitude do socorrista é:
A) Realizar a abertura de vias aéreas.
B) Avaliar o nível de consciência da vítima.
C) Garantir a segurança da cena e a sua própria segurança.
D) Ligar imediatamente para o serviço de emergência.
CORRETA: C
EXPLICAÇÃO: A segurança da cena é prioridade no APH: evita novas vítimas.

---

QUESTÃO 2
TIPO: várias corretas
Quais são sinais de choque?
A) Palidez
B) Taquicardia
C) Bradicardia
D) Sudorese
CORRETA: A, B, D
PONTOS: 2`}</pre>
            <textarea className="fa-input" rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Cole aqui as perguntas..." />
            <div className="fa-actions">
              <button type="button" className="fa-btn" onClick={doImport}>Importar perguntas</button>
              <button type="button" className="fa-btn is-ghost" onClick={() => setImportText("")}>Limpar</button>
            </div>
          </div>
        )}

        {blocks.length === 0 && !showImport && <p className="fa-empty">Nenhuma pergunta ainda. Escolha o tipo abaixo e clique em Adicionar, ou importe várias de uma vez.</p>}

        <div className="fa-qlist">
          {blocks.map((block, index) => {
            if (isQuestion(block.type)) number += 1;
            return (
              <QuestionEditor
                key={block.id}
                block={block}
                index={index}
                total={blocks.length}
                number={number}
                open={Boolean(openIds[block.id])}
                onToggle={() => setOpenIds((current) => ({ ...current, [block.id]: !current[block.id] }))}
                onChange={(patch) => updateBlock(block.id, patch)}
                onMove={(dir) => moveBlock(block.id, dir)}
                onDuplicate={() => duplicateBlock(block.id)}
                onRemove={() => removeBlock(block.id)}
                onUploadImage={(file, field) => uploadImage(block.id, file, field)}
              />
            );
          })}
        </div>

        <div className="fa-add">
          <select className="fa-input" value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="Tipo da nova pergunta">
            {BLOCK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="button" className="fa-btn" onClick={addBlock}>+ Adicionar</button>
        </div>
      </div>
    </section>
  );
}
