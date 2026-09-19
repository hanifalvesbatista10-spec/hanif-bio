import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "ha_intro_seen";
const INTRO_SRC = "/media/hero/brand-intro.mp4";
// HEVC: o arquivo de abertura está nesse codec. Sem suporte, o site abre direto.
const INTRO_CODEC = 'video/mp4; codecs="hvc1.1.6.L120.B0"';
const START_TIMEOUT_MS = 3500;
const HARD_TIMEOUT_MS = 9000;
const FADE_MS = 700;

export function shouldPlayIntro() {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return false;
  } catch {
    /* sessionStorage indisponível: segue e tenta tocar */
  }
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  if (navigator.connection?.saveData) return false;
  const probe = document.createElement("video");
  return Boolean(probe.canPlayType?.(INTRO_CODEC));
}

function markSeen() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignora */
  }
}

export default function BrandIntro({ onFinish }) {
  const [phase, setPhase] = useState("playing"); // playing -> leaving -> done
  const videoRef = useRef(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("leaving");
  };

  useEffect(() => {
    markSeen();
    document.documentElement.style.overflow = "hidden";

    const video = videoRef.current;
    const startTimer = window.setTimeout(() => {
      if (video && video.currentTime === 0) finish();
    }, START_TIMEOUT_MS);
    const hardTimer = window.setTimeout(finish, HARD_TIMEOUT_MS);

    const attempt = video?.play?.();
    if (attempt && typeof attempt.catch === "function") attempt.catch(finish);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(hardTimer);
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return undefined;
    document.documentElement.style.overflow = "";
    onFinishRef.current?.();
    const timer = window.setTimeout(() => setPhase("done"), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div className={`brand-intro ${phase === "leaving" ? "is-leaving" : ""}`} aria-hidden="true">
      <video
        ref={videoRef}
        className="brand-intro-video"
        src={INTRO_SRC}
        muted
        autoPlay
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
      <button type="button" className="brand-intro-skip" tabIndex={-1} onClick={finish}>
        Pular
      </button>
    </div>
  );
}
