import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { fetchMuxTokens } from "../../services/mux";

// O player do Mux só é baixado quando existe uma aula em Mux aberta.
const MuxPlayer = lazy(() => import("@mux/mux-player-react"));

const messages = {
  not_ready: "Este vídeo ainda está sendo processado. Volte em alguns minutos.",
  forbidden: "Você não tem acesso a este vídeo.",
  unauthenticated: "Sua sessão expirou. Entre novamente para assistir.",
  mux_not_configured: "A reprodução protegida ainda não foi configurada. Avise o suporte.",
  not_deployed: "A reprodução protegida só funciona no site publicado.",
};

// Marca d'água com o nome do próprio espectador: desestimula compartilhar gravações de tela.
function Watermark({ label }) {
  const [spot, setSpot] = useState({ top: 14, left: 12 });
  useEffect(() => {
    const move = () => setSpot({ top: 8 + Math.random() * 74, left: 4 + Math.random() * 46 });
    move();
    const timer = setInterval(move, 18000);
    return () => clearInterval(timer);
  }, []);
  if (!label) return null;
  return (
    <div className="member-watermark" style={{ top: `${spot.top}%`, left: `${spot.left}%` }} aria-hidden="true">
      {label}
    </div>
  );
}

export default function MuxLessonPlayer({ lesson }) {
  const { user, profile } = useAuth();
  const [state, setState] = useState({ status: "loading" });
  const requested = useRef(null);

  useEffect(() => {
    let cancelled = false;
    requested.current = lesson.id;
    setState({ status: "loading" });
    fetchMuxTokens(lesson.id)
      .then((data) => {
        if (!cancelled && requested.current === lesson.id) setState({ status: "ready", data });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", code: error.code, message: messages[error.code] || error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id]);

  const viewer = [profile?.full_name, user?.email].filter(Boolean).join(" · ");

  return (
    <div className="member-mux" onContextMenu={(event) => event.preventDefault()}>
      {state.status === "ready" && (
        <Suspense fallback={<div className="member-mux-note">Carregando player...</div>}>
          <MuxPlayer
            key={lesson.id}
            streamType="on-demand"
            playbackId={state.data.playbackId}
            tokens={state.data.tokens}
            metadata={{ video_title: lesson.title }}
            accentColor="#d6152d"
            style={{ display: "block", width: "100%", aspectRatio: "16 / 9" }}
          />
          <Watermark label={viewer} />
        </Suspense>
      )}
      {state.status === "loading" && <div className="member-mux-note">Liberando vídeo protegido...</div>}
      {state.status === "error" && (
        <div className="member-mux-note is-error" role="alert">{state.message}</div>
      )}
    </div>
  );
}
