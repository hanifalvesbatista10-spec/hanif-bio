import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { icons } from "../../components/admin/AdminIcons";
import { supabase } from "../../services/supabase";
import { youtubeId } from "../../services/video";

const statusLabels = { draft: "Rascunho", published: "Publicada" };
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function emptyLesson(productId, position) {
  return { id: null, product_id: productId, title: "", description: "", video_url: "", duration: "", status: "draft", position };
}

function byOrder(a, b) {
  return (a.position - b.position) || String(a.created_at || "").localeCompare(String(b.created_at || ""));
}

// Janela de edição: só abre ao clicar em "Editar" ou "Nova aula" e fecha ao salvar.
function LessonDialog({ lesson, saving, error, onSave, onClose }) {
  const [draft, setDraft] = useState(lesson);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(lesson), [draft, lesson]);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm("Descartar as alterações desta aula?")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const html = document.documentElement;
    const previous = document.activeElement;
    html.classList.add("adm-scroll-lock");
    firstFieldRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      html.classList.remove("adm-scroll-lock");
      previous?.focus?.();
    };
  }, [requestClose]);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    onSave(draft);
  };

  return (
    <div className="adm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div className="adm-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lesson-dialog-title">
        <form onSubmit={submit}>
          <header className="adm-dialog-head">
            <h3 id="lesson-dialog-title">{draft.id ? "Editar aula" : "Nova aula"}</h3>
            <button type="button" className="adm-icon-button" aria-label="Fechar" onClick={requestClose}>{icons.close}</button>
          </header>

          <div className="adm-dialog-body">
            <div className="form-grid two">
              <label>Título<input ref={firstFieldRef} value={draft.title} onChange={(e) => set("title", e.target.value)} required /></label>
              <label>Link do vídeo (YouTube)<input value={draft.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." required /></label>
            </div>
            <label>Descrição<textarea rows={3} value={draft.description || ""} onChange={(e) => set("description", e.target.value)} /></label>
            <div className="form-grid three">
              <label>Duração<input value={draft.duration || ""} onChange={(e) => set("duration", e.target.value)} placeholder="Ex: 12min" /></label>
              <label>
                Status
                <select value={draft.status} onChange={(e) => set("status", e.target.value)}>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>Ordem<input type="number" min="0" value={draft.position} onChange={(e) => set("position", e.target.value)} /></label>
            </div>
            {draft.status === "draft" && (
              <p className="adm-hint">Rascunho: o aluno não vê esta aula até você publicar.</p>
            )}
            {error && <div className="admin-alert error" role="alert">{error}</div>}
          </div>

          <footer className="adm-dialog-foot">
            <button type="button" className="admin-button adm-ghost" onClick={requestClose}>Cancelar</button>
            <button type="submit" className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar aula"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default function LessonsPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    const [productsResult, lessonsResult] = await Promise.all([
      supabase.from("products").select("id,title").order("title", { ascending: true }),
      supabase.from("product_lessons").select("*").order("position", { ascending: true }),
    ]);

    if (productsResult.data) {
      setProducts(productsResult.data);
      setProductId((current) => current || productsResult.data[0]?.id || "");
    }

    if (lessonsResult.error) {
      notify(
        "error",
        lessonsResult.error.message.includes("does not exist") || lessonsResult.error.message.includes("relation")
          ? "O banco ainda não tem a tabela de aulas. Execute supabase/12_area_de_membros.sql no SQL Editor e tente novamente."
          : `Erro ao carregar: ${lessonsResult.error.message}`
      );
    } else {
      setAllLessons(lessonsResult.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lessons = useMemo(
    () => allLessons.filter((lesson) => lesson.product_id === productId).sort(byOrder),
    [allLessons, productId]
  );
  const publishedCount = lessons.filter((lesson) => lesson.status === "published").length;
  const product = products.find((item) => item.id === productId);

  const countFor = (id) => allLessons.filter((lesson) => lesson.product_id === id).length;

  const replaceLesson = (saved) =>
    setAllLessons((current) =>
      current.some((item) => item.id === saved.id)
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved]
    );

  const openNew = () => {
    setDialogError("");
    const next = lessons.reduce((max, lesson) => Math.max(max, Number(lesson.position) || 0), 0) + 1;
    setEditing(emptyLesson(productId, next));
  };

  const openEdit = (lesson) => {
    setDialogError("");
    setEditing({ ...lesson, position: lesson.position ?? 0 });
  };

  const saveLesson = async (row) => {
    const title = row.title.trim();
    const videoUrl = row.video_url.trim();
    if (!title || !videoUrl) {
      setDialogError("Preencha ao menos o título e o link do vídeo.");
      return;
    }

    setSaving(true);
    setDialogError("");

    const payload = {
      product_id: productId,
      title,
      description: row.description?.trim() || null,
      video_url: videoUrl,
      duration: row.duration?.trim() || null,
      status: row.status,
      position: Number(row.position) || 0,
    };

    const result = row.id
      ? await supabase.from("product_lessons").update(payload).eq("id", row.id).select("*").single()
      : await supabase.from("product_lessons").insert(payload).select("*").single();

    if (result.error) {
      setDialogError(`Erro ao salvar: ${result.error.message}`);
    } else {
      replaceLesson(result.data);
      setEditing(null);
      notify("success", `Aula “${result.data.title}” salva. ${result.data.status === "published" ? "O aluno já pode vê-la." : "Ela continua como rascunho."}`);
    }
    setSaving(false);
  };

  const toggleStatus = async (lesson) => {
    const next = lesson.status === "published" ? "draft" : "published";
    setBusyId(lesson.id);
    const { data, error } = await supabase.from("product_lessons").update({ status: next }).eq("id", lesson.id).select("*").single();
    if (error) notify("error", `Erro ao alterar status: ${error.message}`);
    else {
      replaceLesson(data);
      notify("success", next === "published" ? `“${lesson.title}” publicada.` : `“${lesson.title}” voltou para rascunho e saiu da área do aluno.`);
    }
    setBusyId(null);
  };

  const removeLesson = async (lesson) => {
    if (!window.confirm(`Excluir a aula “${lesson.title}” definitivamente?`)) return;
    setBusyId(lesson.id);
    const { error } = await supabase.from("product_lessons").delete().eq("id", lesson.id);
    if (error) notify("error", `Erro ao excluir: ${error.message}`);
    else {
      setAllLessons((current) => current.filter((item) => item.id !== lesson.id));
      notify("success", "Aula excluída.");
    }
    setBusyId(null);
  };

  // Troca a ordem com a aula vizinha (renumera 1..n para evitar posições repetidas).
  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= lessons.length) return;
    const reordered = lessons.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const updates = reordered
      .map((lesson, i) => ({ lesson, position: i + 1 }))
      .filter(({ lesson, position }) => lesson.position !== position);

    setBusyId(lessons[index].id);
    const results = await Promise.all(
      updates.map(({ lesson, position }) => supabase.from("product_lessons").update({ position }).eq("id", lesson.id).select("*").single())
    );
    const failed = results.find((result) => result.error);
    if (failed) notify("error", `Erro ao reordenar: ${failed.error.message}`);
    else {
      results.forEach((result) => replaceLesson(result.data));
      notify("success", "Ordem atualizada.");
    }
    setBusyId(null);
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Aulas por produto</h2>
        </div>
        <button type="button" className="admin-button primary" onClick={openNew} disabled={!productId}>+ Nova aula</button>
      </div>

      <div className="adm-controls is-single">
        <label>
          Produto
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((item) => (
              <option key={item.id} value={item.id}>{item.title} ({countFor(item.id)} aula{countFor(item.id) === 1 ? "" : "s"})</option>
            ))}
          </select>
        </label>
      </div>

      <div className="adm-facts">
        <span><strong>{lessons.length}</strong> aula(s) cadastrada(s)</span>
        <span><strong>{publishedCount}</strong> publicada(s) — o aluno vê</span>
        <span><strong>{lessons.length - publishedCount}</strong> rascunho(s)</span>
        <Link to={`/admin/auditoria${productId ? `?produto=${productId}` : ""}`}>Abrir auditoria →</Link>
      </div>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : lessons.length === 0 ? (
        <div className="admin-empty">
          Nenhuma aula cadastrada para {product ? `“${product.title}”` : "este produto"} ainda.
          <br />
          <button type="button" className="admin-button primary" style={{ marginTop: 14 }} onClick={openNew}>Cadastrar a primeira aula</button>
        </div>
      ) : (
        <ol className="adm-lesson-list" aria-label={`Aulas de ${product?.title || "produto"}`}>
          {lessons.map((lesson, index) => {
            const id = youtubeId(lesson.video_url);
            const published = lesson.status === "published";
            return (
              <li key={lesson.id} className={`adm-lesson ${published ? "" : "is-draft"}`}>
                <div className="adm-lesson-order">
                  <span aria-label={`Ordem ${lesson.position}`}>{lesson.position}</span>
                  <div className="adm-lesson-move">
                    <button type="button" aria-label="Subir aula" disabled={index === 0 || busyId === lesson.id} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" aria-label="Descer aula" disabled={index === lessons.length - 1 || busyId === lesson.id} onClick={() => move(index, 1)}>↓</button>
                  </div>
                </div>

                <div className="adm-lesson-thumb">
                  {id ? <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" /> : <span>Sem miniatura</span>}
                </div>

                <div className="adm-lesson-info">
                  <strong>{lesson.title}</strong>
                  {lesson.description && <p>{lesson.description}</p>}
                  <small>
                    {lesson.duration || "Sem duração"} · {id ? "Vídeo do YouTube" : "Link fora do padrão do YouTube"}
                  </small>
                </div>

                <div className="adm-lesson-status">
                  <span className={`status-badge ${lesson.status}`}>{statusLabels[lesson.status] || lesson.status}</span>
                </div>

                <div className="adm-lesson-actions">
                  <button type="button" className="adm-action is-primary" onClick={() => openEdit(lesson)}>Editar</button>
                  <button type="button" className="adm-action" disabled={busyId === lesson.id} onClick={() => toggleStatus(lesson)}>
                    {published ? "Tirar do ar" : "Publicar"}
                  </button>
                  <Link className="adm-action" to={`/admin/area-de-membros?produto=${lesson.product_id}&aula=${lesson.id}`}>Ver como aluno</Link>
                  <button type="button" className="adm-action is-danger" disabled={busyId === lesson.id} onClick={() => removeLesson(lesson)}>Excluir</button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <LessonDialog
          key={editing.id || "new"}
          lesson={editing}
          saving={saving}
          error={dialogError}
          onSave={saveLesson}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
