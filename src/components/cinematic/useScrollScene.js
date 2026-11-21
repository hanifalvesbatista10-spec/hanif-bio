import { useEffect, useState } from "react";

// Controla a cena da abertura pela rolagem.
//
// O estado visual é uma função pura do progresso (0 a 1) dentro da "pista" (o bloco alto que contém a cena fixa), então:
//  - rolar para cima volta a narrativa no sentido inverso;
//  - ao parar, tudo estabiliza (nada depende de temporizador);
//  - rolagem nativa, teclado, toque e âncoras continuam valendo (a cena é só `position: sticky`).
// O progresso vira variáveis CSS no elemento da cena (`--p`, `--t1o`...), sem re-renderizar o React a cada evento.

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
// 0 antes de `from`, 1 depois de `to`, curva suave no meio
const seg = (p, from, to) => {
  const x = clamp((p - from) / (to - from));
  return x * x * (3 - 2 * x);
};

// Janelas do progresso (0 a 1). No celular a troca de cena acontece antes, porque cada etapa usa um recorte vertical próprio.
const DESKTOP = {
  push: [0, 0.34], // aproximação curta da cena de abertura
  openOut: [0.24, 0.36], // a abertura cruza para a sala de simulação, já em close no manequim e na maca (preparo)
  prepOut: [0.5, 0.62],
  pull: [0.42, 0.86], // a sala recua e revela o instrutor (treinamento)
  moments: [
    { in: [0, 0], out: [0.2, 0.28] },
    { in: [0.3, 0.37], out: [0.5, 0.57] },
    { in: [0.6, 0.67], out: [0.8, 0.86] },
    { in: [0.88, 0.95], out: [2, 3] },
  ],
};
const MOBILE = {
  push: [0, 0.3],
  openOut: [0.22, 0.32],
  prepOut: [0.52, 0.62],
  pull: [0.5, 0.86],
  moments: DESKTOP.moments,
};

const ACTIVE_BREAKS = [0.29, 0.58, 0.87]; // quem está "ativo" (recebe clique e foco)

export function applyScene(stage, p, mobile) {
  const cfg = mobile ? MOBILE : DESKTOP;
  const set = (name, value) => stage.style.setProperty(name, String(Math.round(value * 1000) / 1000));

  set("--p", p);
  set("--push", seg(p, ...cfg.push));
  set("--open-o", 1 - seg(p, ...cfg.openOut));
  set("--prep-o", 1 - seg(p, ...cfg.prepOut));
  set("--pull", seg(p, ...cfg.pull));
  // véu escuro: ajuda a leitura na aproximação e fecha a cena em azul-marinho, que é a cor da seção seguinte
  set("--veil", 0.4 * seg(p, 0.02, 0.22) * (1 - seg(p, 0.24, 0.38)) + 0.92 * seg(p, 0.84, 0.97));

  cfg.moments.forEach((moment, index) => {
    const appear = moment.in[1] === moment.in[0] ? 1 : seg(p, ...moment.in);
    const leave = seg(p, ...moment.out);
    set(`--t${index + 1}o`, appear * (1 - leave));
    // entra subindo e sai subindo (continuidade de movimento): -1 (sai) .. 0 (parado) .. 1 (ainda vai entrar)
    set(`--t${index + 1}y`, (1 - appear) - leave);
  });

  return ACTIVE_BREAKS.filter((limit) => p >= limit).length;
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export default function useScrollScene({ trackRef, stageRef, mobile, enabled }) {
  useEffect(() => {
    if (!enabled) return undefined;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return undefined;

    let frame = 0;
    let alive = true;
    let visible = true;
    let lastP = -1;
    let activeIndex = -1;
    const moments = [...stage.querySelectorAll("[data-moment]")];

    // Só o momento ativo recebe foco por teclado: os links dos outros ficam fora da ordem de tabulação.
    const setActive = (index) => {
      if (index === activeIndex) return;
      activeIndex = index;
      stage.dataset.active = String(index);
      moments.forEach((moment, i) => {
        moment.querySelectorAll("a, button").forEach((el) => {
          if (i === index) el.removeAttribute("tabindex");
          else el.setAttribute("tabindex", "-1");
        });
      });
    };

    const update = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      // a cena fica fixa logo abaixo do cabeçalho (`top` do sticky); o progresso conta só enquanto ela está fixa
      const stuckTop = parseFloat(getComputedStyle(stage).top) || 0;
      const total = Math.max(1, rect.height - stage.offsetHeight);
      const p = clamp((stuckTop - rect.top) / total);
      if (Math.abs(p - lastP) < 0.0005) return;
      lastP = p;
      setActive(applyScene(stage, p, mobile));
    };

    const request = () => {
      if (!alive || !visible || frame) return;
      frame = window.requestAnimationFrame(update);
    };

    // Fora da tela não calcula nada; ao voltar, recalcula na hora (um salto por âncora pode ter pulado a pista).
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          lastP = -1;
          request();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(track);

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      lastP = -1;
      request();
    });
    resizeObserver?.observe(track);

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    window.addEventListener("orientationchange", request);
    // as fontes mudam a altura do texto, mas a cena tem altura fixa; mesmo assim recalcula ao terminar de carregar
    document.fonts?.ready?.then(() => {
      lastP = -1;
      request();
    });

    lastP = -1;
    update();

    return () => {
      alive = false;
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      window.removeEventListener("orientationchange", request);
      observer.disconnect();
      resizeObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      moments.forEach((moment) => moment.querySelectorAll("a, button").forEach((el) => el.removeAttribute("tabindex")));
    };
  }, [trackRef, stageRef, mobile, enabled]);
}
