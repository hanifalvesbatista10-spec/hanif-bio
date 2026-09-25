import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { memberIcons as icons } from "./MemberIcons";
import useInstallApp from "./useInstallApp";
import "../../styles/member-shell.css";

const NAV = [
  { to: "/minha-area", label: "Meus cursos", icon: "courses", match: (path) => path === "/minha-area" || path.startsWith("/minha-area/curso") },
  { to: "/minha-area/atividades", label: "Atividades", icon: "activities", match: (path) => path.startsWith("/minha-area/atividades") },
  { to: "/minha-area/certificados", label: "Certificados", icon: "certificate", match: (path) => path.startsWith("/minha-area/certificados") },
  { to: "/minha-area/configuracoes", label: "Configurações", icon: "settings", match: (path) => path.startsWith("/minha-area/configuracoes") },
];

export function initialsOf(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ profile, size = 36 }) {
  return (
    <span className="mb-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initialsOf(profile?.full_name || profile?.email)}</span>}
    </span>
  );
}

function UserMenu() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const app = useInstallApp();

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return undefined;
    wrapRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onPointer = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0] || "Aluno";
  const go = (to) => () => navigate(to);
  const leave = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const items = [
    { label: "Meus dados", icon: "user", onClick: go("/minha-area/configuracoes?aba=dados") },
    { label: "Alterar senha", icon: "lock", onClick: go("/minha-area/configuracoes?aba=seguranca&alterar=1") },
    ...(app.available ? [{ label: "Instalar aplicativo", icon: "download", onClick: () => app.install() }] : []),
    ...(isAdmin ? [{ label: "Painel administrativo", icon: "panel", onClick: go("/admin") }] : []),
    { label: "Voltar ao site", icon: "globe", onClick: go("/") },
    { label: "Sair", icon: "logout", danger: true, onClick: leave },
  ];

  return (
    <div className="mb-user" ref={wrapRef}>
      <button ref={buttonRef} type="button" className="mb-user-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Avatar profile={profile} />
        <span className="mb-user-name">{firstName}</span>
        <svg className="mb-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="mb-menu" role="menu" aria-label="Minha conta">
          <div className="mb-menu-head">
            <strong>{profile?.full_name || "Aluno"}</strong>
            <small>{profile?.email}</small>
          </div>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`mb-menu-item${item.danger ? " is-danger" : ""}`}
              onClick={item.onClick}
              onKeyDown={(event) => {
                const list = [...wrapRef.current.querySelectorAll('[role="menuitem"]')];
                const index = list.indexOf(event.currentTarget);
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  list[(index + 1) % list.length].focus();
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  list[(index - 1 + list.length) % list.length].focus();
                }
              }}
            >
              {icons[item.icon]}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Estrutura da área do aluno: barra superior (navegação e conta), conteúdo e, no celular, barra de abas embaixo.
export default function MemberLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="mb">
      <a className="mb-skip" href="#mb-main">Ir para o conteúdo</a>
      <header className="mb-top">
        <div className="mb-top-in">
          <Link className="mb-brand" to="/minha-area" aria-label="Área do aluno, início">
            <span className="mb-brand-mark"><img src="/assets/logo-ha.png" alt="" /></span>
            <span className="mb-brand-text">
              <strong>Hanif Alves</strong>
              <small>Área do aluno</small>
            </span>
          </Link>
          <nav className="mb-nav" aria-label="Área do aluno">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end className={`mb-nav-link${item.match(location.pathname) ? " is-active" : ""}`} aria-current={item.match(location.pathname) ? "page" : undefined}>
                {icons[item.icon]}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>

      <main id="mb-main" className="mb-main" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="mb-tabbar" aria-label="Navegação principal">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end className={`mb-tab${item.match(location.pathname) ? " is-active" : ""}`}>
            {icons[item.icon]}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
