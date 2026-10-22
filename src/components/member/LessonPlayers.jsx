import { useEffect, useRef, useState } from "react";
import { getR2DownloadUrl } from "../../services/r2";
import { toEmbedUrl, youtubeId } from "../../services/video";

// Player do YouTube que avisa quando o vídeo termina (API de mensagens do próprio player, sem biblioteca extra).
// Links que não são do YouTube seguem como vieram, sem aviso de fim.
export function YouTubePlayer({ lesson, onEnded }) {
  const frameRef = useRef(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const isYoutube = Boolean(youtubeId(lesson.video_url));

  useEffect(() => {
    if (!isYoutube) return undefined;
    const onMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const state = data?.event === "onStateChange" ? data.info : data?.event === "infoDelivery" ? data.info?.playerState : null;
      if (state === 0) endedRef.current?.();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isYoutube, lesson.id]);

  const listen = () => {
    if (isYoutube) frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
  };

  const base = toEmbedUrl(lesson.video_url);
  const src = isYoutube ? `${base}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}` : base;

  return (
    <div className="member-video">
      <iframe
        ref={frameRef}
        key={lesson.id}
        src={src}
        title={lesson.title}
        onLoad={listen}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

const NARROW = "(max-width: 767px), (pointer: coarse)";

// Aula em PDF. No computador o PDF abre dentro da página; no celular (onde o navegador costuma mostrar só a primeira página
// ou nada) aparece um cartão com os botões de abrir e baixar. O link vem do servidor, vale poucos minutos e só sai se o aluno
// tiver acesso à aula.
export function PdfLesson({ lesson }) {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const [state, setState] = useState({ status: "loading", url: "", error: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // no computador, já pede o link de leitura; no celular só quando o aluno tocar em abrir/baixar
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", url: "", error: "" });
    if (narrow || !lesson.attachment_file_path) {
      setState({ status: "idle", url: "", error: "" });
      return undefined;
    }
    getR2DownloadUrl("lesson", lesson.id, { inline: true })
      .then(({ url }) => !cancelled && setState({ status: "ready", url, error: "" }))
      .catch((error) => !cancelled && setState({ status: "error", url: "", error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [lesson.id, lesson.attachment_file_path, narrow]);

  const open = async (inline) => {
    setBusy(true);
    try {
      const { url } = await getR2DownloadUrl("lesson", lesson.id, { inline });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
    setBusy(false);
  };

  if (!lesson.attachment_file_path) {
    return (
      <div className="mb-pdf is-card">
        <p className="mb-pdf-name">O arquivo desta aula ainda não foi enviado.</p>
      </div>
    );
  }

  const name = lesson.attachment_file_name || "Material em PDF";

  return (
    <div className="mb-pdf">
      {!narrow && state.status === "ready" && (
        <iframe className="mb-pdf-frame" src={state.url} title={`PDF: ${lesson.title}`} />
      )}
      {!narrow && state.status === "loading" && <div className="mb-pdf-frame is-skeleton" aria-hidden="true" />}
      {(narrow || state.status === "error" || state.status === "idle") && (
        <div className="mb-pdf-card">
          <span className="mb-pdf-icon" aria-hidden="true">PDF</span>
          <strong className="mb-pdf-name">{name}</strong>
          <p>{narrow ? "Toque para ler o PDF no seu aparelho." : "Não foi possível mostrar o PDF aqui. Abra ou baixe o arquivo."}</p>
        </div>
      )}
      <div className="mb-pdf-actions">
        <button type="button" className="mb-btn" onClick={() => open(true)} disabled={busy}>
          {busy ? "Gerando o link..." : "Abrir em nova aba"}
        </button>
        <button type="button" className="mb-btn is-ghost" onClick={() => open(false)} disabled={busy}>
          Baixar PDF
        </button>
      </div>
      {state.error && <p className="mb-pdf-error" role="alert">{state.error}</p>}
    </div>
  );
}
