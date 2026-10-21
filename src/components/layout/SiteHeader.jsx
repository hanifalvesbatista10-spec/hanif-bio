import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

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

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

export default function SiteHeader({ primaryLabel = "Ver treinamentos" }) {
  const { user, isAdmin, isPartner } = useAuth();
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

  // Acesso sempre à vista: quem não entrou vê "Área do aluno" (login); quem já entrou vai direto para a própria área.
  const access = !user
    ? { to: "/login", label: "Área do aluno" }
    : isAdmin
    ? { to: "/admin", label: "Painel" }
    : isPartner
    ? { to: "/parceiro", label: "Área do parceiro" }
    : { to: "/minha-area", label: "Minha área" };

  const closeMenu = () => setMenuOpen(false);
  const anchor = (id) => (isHome ? `#${id}` : `/#${id}`);

  return (
    <header className={`site-header ${scrolled || !isHome ? "is-scrolled" : ""} ${menuOpen ? "is-menu-open" : ""}`}>
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
          <Link to="/radar" onClick={closeMenu}>Radar</Link>
          <a href={anchor("depoimentos")} onClick={closeMenu}>Depoimentos</a>
          <Link className="site-nav-login" to={access.to} onClick={closeMenu}>
            <UserIcon />
            {access.label}
          </Link>
          <a className="site-nav-cta" href={anchor("produtos")} onClick={closeMenu}>
            {primaryLabel}
          </a>
        </nav>
      </div>
    </header>
  );
}
