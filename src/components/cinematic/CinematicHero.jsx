import { Fragment, useMemo, useRef } from "react";
import Button from "../ui/Button";
import { useMentorshipHref } from "../../services/mentorship";
import { resolveCinematic, splitAccent } from "./config";
import useScrollScene, { useMediaQuery } from "./useScrollScene";
import "./cinematic.css";

// Abertura cinematográfica da home (4 momentos guiados pela rolagem): CENA, PREPARAÇÃO, TREINAMENTO e FORMAÇÃO.
//
// Técnica: uma "pista" alta (`.cx-track`) contém uma cena fixa (`position: sticky`). O progresso da rolagem dentro da pista
// vira variáveis CSS (useScrollScene) que movem só `transform` e `opacity` das camadas de imagem e dos textos.
// Textos, links e botões ficam em HTML o tempo todo; se a imagem falhar, o fundo azul-marinho e a navegação continuam.
// Com "reduzir movimento" a cena não fixa nem se mexe: os quatro momentos viram blocos em sequência.

function Accent({ value }) {
  return splitAccent(value).map((part, index) =>
    part.accent ? (
      <span className="cx-accent" key={index}>{part.text}</span>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    )
  );
}

// "/rota" usa o roteador (sem recarregar); "#ancora" e https usam link comum.
function Cta({ href, variant = "primary", children }) {
  return href.startsWith("/") ? (
    <Button to={href} variant={variant}>{children}</Button>
  ) : (
    <Button href={href} variant={variant} external={/^https:/i.test(href)}>{children}</Button>
  );
}

function Moment({ index, children }) {
  return (
    <div className="cx-moment" data-moment data-index={index}>
      {children}
    </div>
  );
}

function Picture({ desktop, desktopSet, mobile, alt = "", priority = false, className = "" }) {
  const saveData = typeof navigator !== "undefined" && Boolean(navigator.connection?.saveData);
  return (
    <picture>
      {mobile && <source media="(max-width: 767px)" srcSet={mobile} />}
      <img
        className={className}
        src={desktop}
        // economia de dados: só a versão menor
        srcSet={saveData ? undefined : desktopSet}
        sizes={desktopSet && !saveData ? "100vw" : undefined}
        alt={alt}
        decoding="async"
        fetchpriority={priority ? "high" : "low"}
        draggable="false"
      />
    </picture>
  );
}

export default function CinematicHero({ settings, pending = false }) {
  const cfg = useMemo(() => resolveCinematic(settings), [settings]);
  const mobile = useMediaQuery("(max-width: 767px)");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  useScrollScene({ trackRef, stageRef, mobile, enabled: !reduced });

  const { media } = cfg;
  const mentorshipHref = useMentorshipHref("#produtos");
  const secondaryHref = cfg.secondaryHref || mentorshipHref;

  const moments = [
    <Moment index={1} key="m1">
      <span className="cx-kicker">{cfg.kicker}</span>
      <h1 className="cx-title"><Accent value={cfg.title1} /></h1>
      {cfg.support1 && <p className="cx-support">{cfg.support1}</p>}
      <div className="cx-actions">
        <Cta href={cfg.primaryHref}>{cfg.primaryLabel}</Cta>
        <Cta href={secondaryHref} variant="secondary">{cfg.secondaryLabel}</Cta>
      </div>
    </Moment>,
    <Moment index={2} key="m2">
      <h2 className="cx-title"><Accent value={cfg.title2} /></h2>
      {cfg.support2 && <p className="cx-support">{cfg.support2}</p>}
    </Moment>,
    <Moment index={3} key="m3">
      <h2 className="cx-title"><Accent value={cfg.title3} /></h2>
      {cfg.support3 && <p className="cx-support">{cfg.support3}</p>}
    </Moment>,
    <Moment index={4} key="m4">
      <h2 className="cx-title"><Accent value={cfg.title4} /></h2>
      {cfg.support4 && <p className="cx-support">{cfg.support4}</p>}
      <div className="cx-actions">
        <Cta href={cfg.cta4Href}>{cfg.cta4Label}</Cta>
      </div>
    </Moment>,
  ];

  // ---- Movimento reduzido: sem fixar, sem parallax e sem imagens só para o efeito ----
  if (reduced) {
    const staticImage = [
      { desktop: media.opening.desktop, set: media.opening.desktopSet, mobile: media.opening.mobile, alt: media.opening.alt, fit: "is-opening" },
      { desktop: media.opening.desktop, set: media.opening.desktopSet, mobile: media.prep.mobile, alt: "", fit: "is-prep" },
      { desktop: media.training.desktop, mobile: media.training.mobile, alt: media.training.alt, fit: "is-training" },
      null,
    ];
    return (
      <section className={`cx-static ${pending ? "is-pending" : ""}`} id="top" aria-label="Apresentação" data-cinematic="static">
        {moments.map((moment, i) => (
          <div className={`cx-static-block ${staticImage[i] ? "" : "is-plain"}`} key={i}>
            {staticImage[i] && (
              <div className={`cx-static-media ${staticImage[i].fit}`} aria-hidden={staticImage[i].alt ? undefined : "true"}>
                <Picture desktop={staticImage[i].desktop} desktopSet={staticImage[i].set} mobile={staticImage[i].mobile} alt={staticImage[i].alt} priority={i === 0} />
              </div>
            )}
            <div className="cx-static-shade" aria-hidden="true" />
            <div className="cx-copy">{moment}</div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="cx-track" ref={trackRef} id="top" aria-label="Apresentação" data-cinematic="scroll">
      <div className="cx-stage" ref={stageRef} data-active="0">
        {/* camadas de imagem (de baixo para cima): treinamento, preparo (só no celular) e abertura */}
        <div className="cx-layer cx-layer-training">
          <Picture desktop={media.training.desktop} mobile={media.training.mobile} alt={media.training.alt} />
        </div>
        {mobile && (
          <div className="cx-layer cx-layer-prep">
            <picture>
              <img src={media.prep.mobile} alt="" decoding="async" fetchpriority="low" draggable="false" />
            </picture>
          </div>
        )}
        <div className="cx-layer cx-layer-open">
          <Picture desktop={media.opening.desktop} desktopSet={media.opening.desktopSet} mobile={media.opening.mobile} alt={media.opening.alt} priority />
        </div>

        <div className="cx-shade" aria-hidden="true" />
        <div className="cx-veil" aria-hidden="true" />

        <div className={`cx-copy ${pending ? "is-pending" : ""}`}>{moments}</div>

        <ol className="cx-rail" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="cx-rail-tick"><span>{String(n).padStart(2, "0")}</span></li>
          ))}
          <li className="cx-rail-bar"><i /></li>
        </ol>
      </div>
    </section>
  );
}
