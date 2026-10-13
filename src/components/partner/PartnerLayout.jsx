import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/admin-shell.css";
import "../../styles/partner-area.css";

// Área do parceiro: só provas (pré e pós-testes). Layout próprio e enxuto, sem nada do painel do administrador.
export default function PartnerLayout() {
  const { partner, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  const name = partner?.display_name || profile?.full_name || "Parceiro";

  const exit = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="pt-shell">
      <header className="pt-header">
        <div className="pt-brand">
          <img src="/assets/logo-ha.png" alt="" />
          <span>
            APH Hardcore
            <small>Área do parceiro</small>
          </span>
        </div>
        <nav className="pt-nav" aria-label="Navegação da área do parceiro">
          <NavLink to="/parceiro/provas" className={({ isActive }) => (isActive ? "is-active" : "")}>Minhas provas</NavLink>
          <NavLink to="/parceiro/comparar" className={({ isActive }) => (isActive ? "is-active" : "")}>Comparar pré e pós</NavLink>
        </nav>
        <div className="pt-user">
          <span title={name}>{name}</span>
          <button type="button" onClick={exit}>Sair</button>
        </div>
      </header>
      <main className="pt-main">
        <Outlet />
      </main>
    </div>
  );
}
