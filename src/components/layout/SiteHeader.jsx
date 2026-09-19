import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

export default function SiteHeader({ primaryLabel = "Ver treinamentos" }) {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const anchor = (id) => (isHome ? `#${id}` : `/#${id}`);

  return (
    <header className={`site-header ${scrolled || !isHome ? "is-scrolled" : ""}`}>
      <div className="site-container site-header-inner">
        <Link className="site-brand" to="/" onClick={closeMenu}>
          <img src="/assets/logo-ha.png" alt="Hanif Alves" />
        </Link>

        <button
          type="button"
          className={`site-menu-toggle ${menuOpen ? "is-open" : ""}`}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
        </button>

        <nav className={`site-nav ${menuOpen ? "is-open" : ""}`}>
          <a href={anchor("produtos")} onClick={closeMenu}>Produtos</a>
          <Link to="/sobre" onClick={closeMenu}>Sobre</Link>
          <Link to="/conteudos" onClick={closeMenu}>Conteúdos</Link>
          <a href={anchor("depoimentos")} onClick={closeMenu}>Depoimentos</a>
          <a className="site-nav-cta" href={anchor("produtos")} onClick={closeMenu}>
            {primaryLabel}
          </a>
        </nav>
      </div>
    </header>
  );
}
