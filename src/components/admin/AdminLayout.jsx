import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { icons } from "./AdminIcons";
import { adminNavGroups, resolveAdminTitle } from "./adminNav";
import "../../styles/admin-shell.css";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function AdminNav({ onNavigate, onExit, onPublicSite }) {
  return (
    <>
      <nav className="adm-nav" aria-label="Navegação do painel administrativo">
        {adminNavGroups.map((group, index) => (
          <div className="adm-nav-group" key={group.label || `g${index}`}>
            {group.label && <p className="adm-nav-label">{group.label}</p>}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `adm-nav-link${isActive ? " is-active" : ""}`}
                onClick={onNavigate}
              >
                {icons[item.icon]}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="adm-nav-foot">
        <button type="button" className="adm-nav-link" onClick={onPublicSite}>
          {icons.external}
          <span>Ver site público</span>
        </button>
        <button type="button" className="adm-nav-link is-danger" onClick={onExit}>
          {icons.logout}
          <span>Sair</span>
        </button>
      </div>
    </>
  );
}

function Brand() {
  return (
    <div className="adm-brand">
      <span className="adm-brand-mark">
        <img src="/assets/logo-ha.png" alt="" />
      </span>
      <span className="adm-brand-text">
        <strong>Hanif Alves</strong>
        <small>Painel administrativo</small>
      </span>
    </div>
  );
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const bodyRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  // Fecha o drawer ao trocar de rota.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Volta ao topo a cada navegação entre módulos.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  // Se a tela crescer para desktop com o drawer aberto, fecha.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (event) => {
      if (event.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Drawer aberto: bloqueia scroll, prende o foco, fecha com Escape e devolve o foco.
  useEffect(() => {
    if (!open) return undefined;

    const html = document.documentElement;
    html.classList.add("adm-scroll-lock");
    bodyRef.current?.setAttribute("inert", "");
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const nodes = Array.from(drawerRef.current.querySelectorAll(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const menuButton = menuButtonRef.current;
    const body = bodyRef.current;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      html.classList.remove("adm-scroll-lock");
      body?.removeAttribute("inert");
      menuButton?.focus();
    };
  }, [open, close]);

  const exit = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const goPublic = () => {
    navigate("/");
  };

  const name = profile?.full_name || "Hanif";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar" aria-label="Menu do painel">
        <Brand />
        <AdminNav onExit={exit} onPublicSite={goPublic} />
      </aside>

      <div className="adm-body" ref={bodyRef}>
        <header className="adm-header">
          <button
            type="button"
            ref={menuButtonRef}
            className="adm-menu-button"
            aria-label="Abrir menu do painel"
            aria-expanded={open}
            aria-controls="adm-drawer"
            onClick={() => setOpen(true)}
          >
            {icons.menu}
          </button>
          <h1 className="adm-header-title">{resolveAdminTitle(location.pathname)}</h1>
          <div className="adm-header-user" title={name}>
            <span className="adm-avatar" aria-hidden="true">{initials || "H"}</span>
            <span className="adm-header-name">{name}</span>
          </div>
        </header>

        <main className="adm-main">
          <div className="adm-content">
            <Outlet />
          </div>
        </main>
      </div>

      <div
        className={`adm-backdrop${open ? " is-open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        id="adm-drawer"
        ref={drawerRef}
        className={`adm-drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu do painel"
        aria-hidden={!open}
      >
        <div className="adm-drawer-head">
          <Brand />
          <button
            type="button"
            ref={closeButtonRef}
            className="adm-icon-button"
            aria-label="Fechar menu"
            onClick={close}
          >
            {icons.close}
          </button>
        </div>
        <AdminNav onNavigate={close} onExit={exit} onPublicSite={goPublic} />
      </aside>
    </div>
  );
}
