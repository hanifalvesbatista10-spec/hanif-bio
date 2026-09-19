import { useRef, useState } from "react";

// Carrossel com profundidade: slide ativo no centro, vizinhos reduzidos e esmaecidos.
// Setas, pontos, teclado (← →) e swipe (mobile). Sem autoplay.
export default function DepthCarousel({ slides, label = "Carrossel" }) {
  const [active, setActive] = useState(0);
  const start = useRef(null);
  const count = slides.length;

  const go = (index) => setActive(Math.max(0, Math.min(count - 1, index)));

  const onPointerDown = (event) => {
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1));
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(active - 1);
    }
  };

  return (
    <div
      className="hx-carousel"
      role="group"
      aria-roledescription="carrossel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        className="hx-carousel-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; }}
      >
        {slides.map((slide, index) => {
          const offset = index - active;
          const pos = Math.abs(offset) > 1 ? (offset < 0 ? "far-prev" : "far-next") : String(offset);
          return (
            <div
              key={slide.key}
              className="hx-carousel-slide"
              data-pos={pos}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} de ${count}`}
              aria-hidden={offset !== 0}
              onClick={offset !== 0 && Math.abs(offset) === 1 ? () => go(index) : undefined}
            >
              {slide.node}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="hx-carousel-controls">
          <button type="button" className="hx-carousel-arrow" aria-label="Depoimento anterior" onClick={() => go(active - 1)} disabled={active === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
          </button>
          <div className="hx-carousel-dots" role="tablist" aria-label="Escolher depoimento">
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Ir para o depoimento ${index + 1}`}
                className={index === active ? "is-active" : ""}
                onClick={() => go(index)}
              />
            ))}
          </div>
          <button type="button" className="hx-carousel-arrow" aria-label="Próximo depoimento" onClick={() => go(active + 1)} disabled={active === count - 1}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        </div>
      )}
      <p className="hx-sr-only" aria-live="polite">{`Depoimento ${active + 1} de ${count}`}</p>
    </div>
  );
}
