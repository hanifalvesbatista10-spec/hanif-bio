import { useEffect, useRef, useState } from "react";

const DESKTOP = {
  video: "/media/hero/hero-desktop.mp4",
  poster: "/media/hero/hero-desktop-poster.webp",
  // O arquivo desktop está em HEVC: sem suporte do navegador, fica só o poster.
  codec: 'video/mp4; codecs="hvc1.1.6.L153.B0"',
};
const MOBILE = {
  video: "/media/hero/hero-mobile.mp4",
  poster: "/media/hero/hero-mobile-poster.webp",
  codec: 'video/mp4; codecs="avc1.640028"',
};

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export default function HeroMedia({ alt, hold = false }) {
  const videoRef = useRef(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const asset = isMobile ? MOBILE : DESKTOP;
  const saveData = Boolean(navigator.connection?.saveData);
  const canPlay = Boolean(document.createElement("video").canPlayType(asset.codec));
  const showVideo = !reduceMotion && !saveData && canPlay && !failed;

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [asset.video]);

  // Enquanto a abertura estiver na tela, o vídeo carrega mas só começa a tocar depois dela.
  useEffect(() => {
    if (!hold) videoRef.current?.play?.().catch(() => {});
  }, [hold, showVideo, asset.video]);

  return (
    <div className="site-hero-media">
      <div className="site-hero-frame">
        <img
          className="site-hero-poster"
          src={asset.poster}
          alt={alt}
          fetchpriority="high"
          decoding="async"
        />
        {showVideo && (
          <video
            key={asset.video}
            ref={videoRef}
            className={`site-hero-video ${ready ? "is-ready" : ""}`}
            src={asset.video}
            muted
            loop
            autoPlay={!hold}
            playsInline
            preload="metadata"
            aria-hidden="true"
            onPlaying={() => setReady(true)}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
