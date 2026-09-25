import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { icons } from "../../components/admin/AdminIcons";
import RowActions from "../../components/admin/RowActions";
import { supabase } from "../../services/supabase";
import { createMuxUpload, deleteMuxAsset, formatDuration, getMuxUploadState, uploadFileToMux } from "../../services/mux";
import { youtubeId } from "../../services/video";
import { fetchLessonsAndLinks, lessonsForProduct, productIdsOfLesson } from "../../services/lessons";

const statusLabels = { draft: "Rascunho", published: "Publicada" };
const muxStatusLabels = {
  uploading: "Enviando ao Mux",
  processing: "Processando no Mux",
  ready: "Vídeo Mux pronto",
  errored: "Erro no Mux",
};
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
const MAX_FILE_GB = 5;

function emptyLesson(productId, position) {
  return {
    id: null, product_id: productId, product_ids: [productId], topics_text: "", title: "", description: "", video_url: "", duration: "",
    status: "draft", position, video_provider: "youtube",
  };
}

function isMux(lesson) {
  return lesson.video_provider === "mux";
}

function formatSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

// Janela de edição: só abre ao clicar em "Editar" ou "Nova aula" e fecha ao salvar.
function LessonDialog({ lesson, products, sharing, currentProductId, saving, phase, progress, error, onSave, onClose }) {
  const [draft, setDraft] = useState(lesson);
  const [file, setFile] = useState(null);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(lesson) || Boolean(file), [draft, lesson, file]);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm("Descartar as alterações desta aula?")) return;
    onClose();
  }, [dirty, saving, onClose]);

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
  const mux = isMux(draft);
  const hasMuxVideo = Boolean(lesson.mux_upload_id);

  const pickFile = (event) => {
    const picked = event.target.files?.[0] || null;
    if (picked && !picked.type.startsWith("video/")) {
      window.alert("Escolha um arquivo de vídeo (MP4, MOV, MKV...).");
      event.target.value = "";
      return;
    }
    if (picked && picked.size > MAX_FILE_GB * 1024 ** 3) {
      window.alert(`O arquivo passa de ${MAX_FILE_GB} GB. Reduza ou comprima o vídeo antes de enviar.`);
      event.target.value = "";
      return;
    }
    setFile(picked);
  };

  const submit = (event) => {
    event.preventDefault();
    onSave(draft, file);
  };

  return (
    <div className="adm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div className="adm-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lesson-dialog-title">
        <form onSubmit={submit}>
          <header className="adm-dialog-head">
            <h3 id="lesson-dialog-title">{draft.id ? "Editar aula" : "Nova aula"}</h3>
            <button type="button" className="adm-icon-button" aria-label="Fechar" onClick={requestClose} disabled={saving}>{icons.close}</button>
          </header>

          <div className="adm-dialog-body">
            <label>Título<input ref={firstFieldRef} value={draft.title} onChange={(e) => set("title", e.target.value)} required disabled={saving} /></label>

            <fieldset className="adm-provider" disabled={saving}>
              <legend>Onde o vídeo fica hospedado</legend>
              <label className={`adm-provider-option ${!mux ? "is-active" : ""}`}>
                <input type="radio" name="provider" checked={!mux} onChange={() => set("video_provider", "youtube")} />
                <span>
                  <strong>YouTube</strong>
                  <small>Cole o link. Simples, mas quem tem o link pode repassar.</small>
                </span>
              </label>
              <label className={`adm-provider-option ${mux ? "is-active" : ""}`}>
                <input type="radio" name="provider" checked={mux} onChange={() => set("video_provider", "mux")} />
                <span>
                  <strong>Mux · protegido</strong>
                  <small>Envie o arquivo. Só quem tem acesso ativo assiste, com link que expira.</small>
                </span>
              </label>
            </fieldset>

            {mux ? (
              <div className="adm-mux-box">
                {hasMuxVideo && (
                  <p className="adm-mux-current">
                    Vídeo atual: <strong>{muxStatusLabels[lesson.mux_status] || "enviado"}</strong>
                    {lesson.duration_seconds ? ` · ${formatDuration(lesson.duration_seconds)}` : ""}
                  </p>
                )}
                <label>
                  {hasMuxVideo ? "Substituir o vídeo (opcional)" : "Arquivo de vídeo"}
                  <input type="file" accept="video/*" onChange={pickFile} disabled={saving} />
                </label>
                {file && <p className="adm-hint">{file.name} · {formatSize(file.size)}</p>}
                {saving && phase && (
                  <div className="adm-progress" role="status">
                    <div className="adm-progress-bar"><span style={{ width: `${progress ?? 0}%` }} /></div>
                    <small>{phase}{progress != null ? ` ${progress}%` : ""}</small>
                  </div>
                )}
                <p className="adm-hint">O envio vai direto ao Mux. Depois ele processa o vídeo (de alguns segundos a alguns minutos); a aula mostra “Processando” até ficar pronta.</p>
              </div>
            ) : (
              <label>Link do vídeo (YouTube)<input value={draft.video_url || ""} onChange={(e) => set("video_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." required={!mux} disabled={saving} /></label>
            )}

            <label>Descrição<textarea rows={3} value={draft.description || ""} onChange={(e) => set("description", e.target.value)} disabled={saving} /></label>
            <label>
              Temas que esta aula ensina (um por linha, opcional)
              <textarea
                rows={3}
                value={draft.topics_text || ""}
                onChange={(e) => set("topics_text", e.target.value)}
                placeholder={"Trauma\nTrauma > B - Respiração"}
                disabled={saving}
              />
              <small className="adm-hint">Quando o aluno for mal num tema, o site indica esta aula para ele rever. Use os mesmos nomes de Tema e Subtema das perguntas. Um tema inteiro ("Trauma") ou uma parte ("Trauma &gt; B - Respiração").</small>
            </label>
            <div className="form-grid three">
              <label>Duração<input value={draft.duration || ""} onChange={(e) => set("duration", e.target.value)} placeholder={mux ? "Automática ao ficar pronto" : "Ex: 12min"} disabled={saving} /></label>
              <label>
                Status
                <select value={draft.status} onChange={(e) => set("status", e.target.value)} disabled={saving}>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>Ordem neste curso<input type="number" min="0" value={draft.position} onChange={(e) => set("position", e.target.value)} disabled={saving} /></label>
            </div>
            {draft.status === "draft" && (
              <p className="adm-hint">Rascunho: o aluno não vê esta aula até você publicar.</p>
            )}

            {sharing ? (
              <fieldset className="adm-share" disabled={saving}>
                <legend>Em quais cursos esta aula aparece</legend>
                <div className="adm-share-list">
                  {products.map((item) => {
                    const checked = draft.product_ids.includes(item.id);
                    return (
                      <label key={item.id} className={checked ? "is-checked" : ""}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => set("product_ids", checked ? draft.product_ids.filter((id) => id !== item.id) : [...draft.product_ids, item.id])}
                        />
                        <span>{item.title}{item.id === currentProductId ? " (este curso)" : ""}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="adm-hint">
                  A aula é uma só: mudar o vídeo, o texto ou tirar do ar vale para todos os cursos marcados. Cada curso tem a sua ordem.
                  Quem tem acesso a qualquer um deles assiste.
                </p>
              </fieldset>
            ) : (
              <p className="adm-hint">Para colocar a mesma aula em mais de um curso, rode supabase/22_aulas_compartilhadas.sql no Supabase.</p>
            )}
            {error && <div className="admin-alert error" role="alert">{error}</div>}
          </div>

          <footer className="adm-dialog-foot">
            <button type="button" className="admin-button adm-ghost" onClick={requestClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar aula"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// Janela para reaproveitar aulas que já existem em outros cursos.
function ReuseDialog({ product, candidates, saving, onAdd, onClose }) {
  const [picked, setPicked] = useState([]);
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("adm-scroll-lock");
    searchRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      html.classList.remove("adm-scroll-lock");
    };
  }, [onClose, saving]);

  const term = query.trim().toLowerCase();
  const shown = candidates.filter((item) => !term || item.lesson.title.toLowerCase().includes(term));
  const toggle = (id) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <div className="adm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="reuse-title">
        <header className="adm-dialog-head">
          <h3 id="reuse-title">Adicionar aula de outro curso</h3>
          <button type="button" className="adm-icon-button" aria-label="Fechar" onClick={onClose} disabled={saving}>{icons.close}</button>
        </header>
        <div className="adm-dialog-body">
          <p className="adm-hint">
            Escolha as aulas que já existem para colocá-las também em “{product?.title}”. É a mesma aula: mudou o vídeo ou o texto, muda em todos os cursos.
          </p>
          <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo título…" aria-label="Buscar aula" />
          {candidates.length === 0 ? (
            <div className="admin-empty">Não há aulas de outros cursos para adicionar.</div>
          ) : shown.length === 0 ? (
            <div className="admin-empty">Nenhuma aula com esse nome.</div>
          ) : (
            <ul className="adm-reuse-list">
              {shown.map(({ lesson, courses }) => (
                <li key={lesson.id}>
                  <label className={picked.includes(lesson.id) ? "is-checked" : ""}>
                    <input type="checkbox" checked={picked.includes(lesson.id)} onChange={() => toggle(lesson.id)} disabled={saving} />
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>{courses.join(", ")}{lesson.status === "published" ? "" : " · rascunho"}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="adm-dialog-foot">
          <button type="button" className="admin-button adm-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="admin-button primary" disabled={saving || picked.length === 0} onClick={() => onAdd(picked)}>
            {saving ? "Adicionando..." : picked.length ? `Adicionar ${picked.length} ${picked.length === 1 ? "aula" : "aulas"}` : "Adicionar"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function LessonsPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [allLessons, setAllLessons] = useState([]);
  const [links, setLinks] = useState([]);
  const [sharing, setSharing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [editing, setEditing] = useState(null);
  const [reusing, setReusing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const syncing = useRef(new Set());

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    const [productsResult, lessonData] = await Promise.all([
      supabase.from("products").select("id,title").order("title", { ascending: true }),
      fetchLessonsAndLinks(),
    ]);

    if (productsResult.data) {
      setProducts(productsResult.data);
      setProductId((current) => current || productsResult.data[0]?.id || "");
    }

    if (lessonData.error) {
      notify(
        "error",
        lessonData.error.message.includes("does not exist") || lessonData.error.message.includes("relation")
          ? "O banco ainda não tem a tabela de aulas. Execute supabase/12_area_de_membros.sql no SQL Editor e tente novamente."
          : `Erro ao carregar: ${lessonData.error.message}`
      );
    } else {
      setAllLessons(lessonData.lessons);
      setLinks(lessonData.links);
      setSharing(lessonData.sharing);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lessons = useMemo(() => lessonsForProduct(allLessons, links, productId), [allLessons, links, productId]);
  const publishedCount = lessons.filter((lesson) => lesson.status === "published").length;
  const product = products.find((item) => item.id === productId);
  const titleOf = useCallback((id) => products.find((item) => item.id === id)?.title || "Curso removido", [products]);
  const countFor = (id) => links.filter((link) => link.product_id === id).length;
  const coursesOf = useCallback((lessonId) => productIdsOfLesson(links, lessonId), [links]);

  const replaceLesson = useCallback(
    (saved) =>
      setAllLessons((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved]
      ),
    []
  );

  // Pergunta ao Mux como está o vídeo e grava o resultado na aula (só o admin escreve).
  const syncMuxLesson = useCallback(
    async (lesson, { silent = false } = {}) => {
      if (!lesson.mux_upload_id || syncing.current.has(lesson.id)) return;
      syncing.current.add(lesson.id);
      try {
        const info = await getMuxUploadState(lesson.mux_upload_id);
        let patch = null;
        if (info.state === "ready") {
          patch = {
            mux_status: "ready",
            mux_asset_id: info.assetId,
            mux_playback_id: info.playbackId,
            duration_seconds: info.durationSeconds || null,
            ...(lesson.duration?.trim() ? {} : { duration: formatDuration(info.durationSeconds) || null }),
          };
        } else if (info.state === "errored") {
          patch = { mux_status: "errored" };
        } else if (info.state === "processing" && (lesson.mux_status !== "processing" || lesson.mux_asset_id !== info.assetId)) {
          patch = { mux_status: "processing", mux_asset_id: info.assetId };
        }
        if (patch) {
          const { data, error } = await supabase.from("product_lessons").update(patch).eq("id", lesson.id).select("*").single();
          if (error) throw error;
          replaceLesson(data);
          if (!silent && info.state === "ready") notify("success", `“${lesson.title}” está pronta no Mux.`);
          if (!silent && info.state === "errored") notify("error", `O Mux não conseguiu processar “${lesson.title}”. Envie o vídeo novamente.`);
        } else if (!silent) {
          notify("success", "Ainda processando no Mux. Tente de novo em instantes.");
        }
      } catch (error) {
        if (!silent) notify("error", error.message || "Não foi possível consultar o Mux.");
      } finally {
        syncing.current.delete(lesson.id);
      }
    },
    [replaceLesson]
  );

  // Enquanto houver vídeo processando, consulta o Mux a cada 6 segundos.
  const pendingIds = allLessons
    .filter((lesson) => isMux(lesson) && lesson.mux_upload_id && ["uploading", "processing"].includes(lesson.mux_status))
    .map((lesson) => lesson.id)
    .join(",");

  useEffect(() => {
    if (!pendingIds) return undefined;
    const run = () => {
      allLessons
        .filter((lesson) => pendingIds.split(",").includes(lesson.id))
        .forEach((lesson) => syncMuxLesson(lesson, { silent: true }));
    };
    run();
    const timer = setInterval(run, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIds, syncMuxLesson]);

  const nextPositionIn = (id) => links.filter((link) => link.product_id === id).reduce((max, link) => Math.max(max, Number(link.position) || 0), 0) + 1;

  const openNew = () => {
    setDialogError("");
    setEditing(emptyLesson(productId, nextPositionIn(productId)));
  };

  const openEdit = (lesson) => {
    setDialogError("");
    setEditing({ ...lesson, position: lesson.position ?? 0, product_ids: coursesOf(lesson.id), topics_text: (lesson.topics || []).join("\n") });
  };

  const saveLesson = async (row, file) => {
    const title = row.title.trim();
    const mux = isMux(row);
    const videoUrl = (row.video_url || "").trim();
    const original = row.id ? allLessons.find((item) => item.id === row.id) : null;
    const selected = sharing ? row.product_ids : [productId];

    if (!title) {
      setDialogError("Preencha o título da aula.");
      return;
    }
    if (!mux && !videoUrl) {
      setDialogError("Cole o link do vídeo do YouTube.");
      return;
    }
    if (mux && !file && !original?.mux_upload_id) {
      setDialogError("Escolha o arquivo de vídeo para enviar ao Mux.");
      return;
    }
    if (selected.length === 0) {
      setDialogError("Escolha ao menos um curso para esta aula aparecer.");
      return;
    }

    setSaving(true);
    setDialogError("");
    setProgress(null);

    const payload = {
      title,
      description: row.description?.trim() || null,
      duration: row.duration?.trim() || null,
      status: row.status,
      position: Number(row.position) || 0,
      video_provider: mux ? "mux" : "youtube",
    };
    if (!row.id) payload.product_id = selected.includes(productId) ? productId : selected[0];
    const topics = (row.topics_text || "").split("\n").map((line) => line.trim()).filter(Boolean);
    if (topics.length || (original && "topics" in original)) payload.topics = topics;

    let replacedAssetId = null;

    try {
      if (mux) {
        payload.video_url = null;
        if (file) {
          setPhase("Preparando envio...");
          const upload = await createMuxUpload();
          setPhase("Enviando vídeo ao Mux...");
          setProgress(0);
          await uploadFileToMux({ file, url: upload.url, onProgress: setProgress });
          replacedAssetId = original?.mux_asset_id || null;
          payload.mux_upload_id = upload.uploadId;
          payload.mux_asset_id = null;
          payload.mux_playback_id = null;
          payload.mux_status = "processing";
          payload.duration_seconds = null;
        }
      } else {
        payload.video_url = videoUrl;
        if (original && isMux(original)) {
          // Trocou de Mux para YouTube: limpa os campos do Mux.
          replacedAssetId = original.mux_asset_id || null;
          Object.assign(payload, { mux_upload_id: null, mux_asset_id: null, mux_playback_id: null, mux_status: null, duration_seconds: null });
        }
      }

      setPhase("Salvando aula...");
      const result = row.id
        ? await supabase.from("product_lessons").update(payload).eq("id", row.id).select("*").single()
        : await supabase.from("product_lessons").insert(payload).select("*").single();

      if (result.error) {
        const text = result.error.message || "";
        throw new Error(
          text.includes("topics")
            ? "O banco ainda não tem os temas das aulas. Execute supabase/26_desempenho_turma_e_aluno.sql no Supabase e salve de novo."
            : text.includes("mux_") || text.includes("video_source") || text.includes("provider_check") || text.includes("null value")
            ? "O banco ainda não está pronto para o Mux. Execute supabase/14_mux_video.sql no SQL Editor do Supabase e tente de novo."
            : `Erro ao salvar: ${text}`
        );
      }

      const saved = result.data;

      // Em quais cursos a aula aparece (e em que posição de cada um)
      if (sharing) {
        const existing = links.filter((link) => link.lesson_id === saved.id);
        const removed = existing.filter((link) => !selected.includes(link.product_id)).map((link) => link.product_id);
        const rows = selected
          .filter((id) => id === productId || !existing.some((link) => link.product_id === id))
          .map((id) => ({
            lesson_id: saved.id,
            product_id: id,
            position: id === productId ? Number(row.position) || 0 : nextPositionIn(id),
          }));
        if (rows.length) {
          const { error } = await supabase.from("product_lesson_links").upsert(rows, { onConflict: "lesson_id,product_id" });
          if (error) throw new Error(`A aula foi salva, mas não consegui atualizar os cursos: ${error.message}`);
        }
        if (removed.length) {
          const { error } = await supabase.from("product_lesson_links").delete().eq("lesson_id", saved.id).in("product_id", removed);
          if (error) throw new Error(`A aula foi salva, mas não consegui tirá-la de alguns cursos: ${error.message}`);
        }
      }

      await load();
      setEditing(null);
      const tail = mux && file
        ? "O vídeo está sendo processado no Mux."
        : saved.status === "published" ? "O aluno já pode vê-la." : "Ela continua como rascunho.";
      const where = sharing && selected.length > 1 ? ` Aparece em ${selected.length} cursos.` : "";
      notify("success", `Aula “${saved.title}” salva. ${tail}${where}`);

      // O vídeo antigo no Mux deixa de ser usado: apaga para não gerar cobrança.
      if (replacedAssetId) deleteMuxAsset(replacedAssetId).catch(() => {});
    } catch (error) {
      setDialogError(error.message || "Não foi possível salvar a aula.");
    } finally {
      setSaving(false);
      setPhase("");
      setProgress(null);
    }
  };

  const toggleStatus = async (lesson) => {
    const next = lesson.status === "published" ? "draft" : "published";
    const others = coursesOf(lesson.id).filter((id) => id !== productId);
    setBusyId(lesson.id);
    const { data, error } = await supabase.from("product_lessons").update({ status: next }).eq("id", lesson.id).select("*").single();
    if (error) notify("error", `Erro ao alterar status: ${error.message}`);
    else {
      replaceLesson(data);
      const shared = others.length ? ` Isso vale também para: ${others.map(titleOf).join(", ")}.` : "";
      notify("success", (next === "published" ? `“${lesson.title}” publicada.` : `“${lesson.title}” voltou para rascunho e saiu da área do aluno.`) + shared);
    }
    setBusyId(null);
  };

  const removeLesson = async (lesson) => {
    const hasAsset = isMux(lesson) && lesson.mux_asset_id;
    const courses = coursesOf(lesson.id);
    const shared = courses.length > 1 ? `\n\nEla está em ${courses.length} cursos (${courses.map(titleOf).join(", ")}) e será apagada de TODOS. Para tirar só deste curso, use “Remover deste curso”.` : "";
    const extra = hasAsset ? "\n\nO vídeo também será apagado do Mux." : "";
    if (!window.confirm(`Excluir a aula “${lesson.title}” definitivamente?${shared}${extra}`)) return;
    setBusyId(lesson.id);
    const { error } = await supabase.from("product_lessons").delete().eq("id", lesson.id);
    if (error) {
      notify("error", `Erro ao excluir: ${error.message}`);
    } else {
      setAllLessons((current) => current.filter((item) => item.id !== lesson.id));
      setLinks((current) => current.filter((link) => link.lesson_id !== lesson.id));
      if (hasAsset) {
        try {
          await deleteMuxAsset(lesson.mux_asset_id);
          notify("success", "Aula excluída e vídeo removido do Mux.");
        } catch {
          notify("error", "Aula excluída, mas não consegui apagar o vídeo no Mux. Remova-o pelo painel do Mux para não gerar cobrança.");
        }
      } else {
        notify("success", "Aula excluída.");
      }
    }
    setBusyId(null);
  };

  // Tira a aula só deste curso; ela continua nos outros.
  const unlinkLesson = async (lesson) => {
    if (!window.confirm(`Tirar “${lesson.title}” de “${product?.title}”? Ela continua nos outros cursos.`)) return;
    setBusyId(lesson.id);
    const { error } = await supabase.from("product_lesson_links").delete().eq("lesson_id", lesson.id).eq("product_id", productId);
    if (error) notify("error", `Erro ao remover: ${error.message}`);
    else {
      setLinks((current) => current.filter((link) => !(link.lesson_id === lesson.id && link.product_id === productId)));
      notify("success", `“${lesson.title}” saiu de “${product?.title}”.`);
    }
    setBusyId(null);
  };

  const addExisting = async (ids) => {
    setSaving(true);
    let position = nextPositionIn(productId);
    const rows = ids.map((id) => ({ lesson_id: id, product_id: productId, position: position++ }));
    const { error } = await supabase.from("product_lesson_links").upsert(rows, { onConflict: "lesson_id,product_id" });
    setSaving(false);
    if (error) return notify("error", `Erro ao adicionar: ${error.message}`);
    setLinks((current) => [...current.filter((link) => !(link.product_id === productId && ids.includes(link.lesson_id))), ...rows]);
    setReusing(false);
    notify("success", `${ids.length} ${ids.length === 1 ? "aula adicionada" : "aulas adicionadas"} em “${product?.title}”, no fim da lista.`);
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
      updates.map(({ lesson, position }) =>
        sharing
          ? supabase.from("product_lesson_links").update({ position }).eq("lesson_id", lesson.id).eq("product_id", productId)
          : supabase.from("product_lessons").update({ position }).eq("id", lesson.id)
      )
    );
    const failed = results.find((result) => result.error);
    if (failed) notify("error", `Erro ao reordenar: ${failed.error.message}`);
    else {
      setLinks((current) =>
        current.map((link) => {
          const hit = updates.find(({ lesson }) => lesson.id === link.lesson_id && link.product_id === productId);
          return hit ? { ...link, position: hit.position } : link;
        })
      );
      notify("success", "Ordem atualizada.");
    }
    setBusyId(null);
  };

  const candidates = useMemo(() => {
    if (!sharing) return [];
    const here = new Set(links.filter((link) => link.product_id === productId).map((link) => link.lesson_id));
    return allLessons
      .filter((lesson) => !here.has(lesson.id))
      .map((lesson) => ({ lesson, courses: coursesOf(lesson.id).map(titleOf) }))
      .filter((item) => item.courses.length > 0)
      .sort((a, b) => a.lesson.title.localeCompare(b.lesson.title, "pt-BR"));
  }, [sharing, links, allLessons, productId, coursesOf, titleOf]);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Aulas por produto</h2>
        </div>
        <div className="adm-head-actions">
          {sharing && (
            <button type="button" className="admin-button adm-ghost" onClick={() => setReusing(true)} disabled={!productId}>Adicionar aula de outro curso</button>
          )}
          <button type="button" className="admin-button primary" onClick={openNew} disabled={!productId}>+ Nova aula</button>
        </div>
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

      {!sharing && !loading && (
        <div className="admin-alert" role="status">
          Para usar a mesma aula em vários cursos, rode <strong>supabase/22_aulas_compartilhadas.sql</strong> no SQL Editor do Supabase.
        </div>
      )}

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
            const mux = isMux(lesson);
            const published = lesson.status === "published";
            const waiting = mux && ["uploading", "processing"].includes(lesson.mux_status);
            const courses = coursesOf(lesson.id);
            const others = courses.filter((courseId) => courseId !== productId);
            return (
              <li key={lesson.id} className={`adm-lesson ${published ? "" : "is-draft"}`}>
                <div className="adm-lesson-order">
                  <span aria-label={`Ordem ${lesson.position}`}>{lesson.position}</span>
                  <div className="adm-lesson-move">
                    <button type="button" aria-label="Subir aula" disabled={index === 0 || busyId === lesson.id} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" aria-label="Descer aula" disabled={index === lessons.length - 1 || busyId === lesson.id} onClick={() => move(index, 1)}>↓</button>
                  </div>
                </div>

                <div className={`adm-lesson-thumb ${mux ? "is-mux" : ""}`}>
                  {mux ? (
                    <span>{waiting ? "Processando…" : lesson.mux_status === "errored" ? "Erro" : "Mux"}</span>
                  ) : id ? (
                    <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" />
                  ) : (
                    <span>Sem miniatura</span>
                  )}
                </div>

                <div className="adm-lesson-info">
                  <strong>{lesson.title}</strong>
                  {lesson.description && <p>{lesson.description}</p>}
                  <small>
                    {lesson.duration || "Sem duração"} ·{" "}
                    {mux ? (
                      <span className={`adm-provider-tag is-${lesson.mux_status || "none"}`}>{muxStatusLabels[lesson.mux_status] || "Mux"}</span>
                    ) : id ? "Vídeo do YouTube" : "Link fora do padrão do YouTube"}
                  </small>
                  {(lesson.topics || []).length > 0 && <small className="adm-shared-tag" style={{ background: "#eef6ee", color: "#1d5b32" }}>Ensina: {lesson.topics.join(" · ")}</small>}
                  {others.length > 0 && (
                    <small className="adm-shared-tag" title="Esta aula é uma só: editar ou tirar do ar vale para todos os cursos">
                      Também em: {others.map(titleOf).join(", ")}
                    </small>
                  )}
                </div>

                <div className="adm-lesson-status">
                  <span className={`status-badge ${lesson.status}`}>{statusLabels[lesson.status] || lesson.status}</span>
                </div>

                <div className="adm-lesson-actions">
                  <RowActions
                    label={`Ações da aula ${lesson.title}`}
                    primary={{ label: "Editar", onClick: () => openEdit(lesson) }}
                    items={[
                      { label: published ? "Tirar do ar" : "Publicar", disabled: busyId === lesson.id, onClick: () => toggleStatus(lesson) },
                      { label: "Atualizar status do vídeo", hidden: !(mux && (waiting || lesson.mux_status === "errored")), onClick: () => syncMuxLesson(lesson) },
                      { label: "Ver como aluno", to: `/admin/area-de-membros?produto=${productId}&aula=${lesson.id}` },
                      { label: "Tirar só deste curso", hidden: !(sharing && courses.length > 1), disabled: busyId === lesson.id, onClick: () => unlinkLesson(lesson) },
                      { label: courses.length > 1 ? "Excluir de todos os cursos" : "Excluir aula", danger: true, disabled: busyId === lesson.id, onClick: () => removeLesson(lesson) },
                    ]}
                  />
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
          products={products}
          sharing={sharing}
          currentProductId={productId}
          saving={saving}
          phase={phase}
          progress={progress}
          error={dialogError}
          onSave={saveLesson}
          onClose={() => setEditing(null)}
        />
      )}

      {reusing && <ReuseDialog product={product} candidates={candidates} saving={saving} onAdd={addExisting} onClose={() => setReusing(false)} />}
    </section>
  );
}
