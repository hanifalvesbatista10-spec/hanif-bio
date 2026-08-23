import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const items = [
  ["/admin", "Visão geral"],
  ["/admin/site", "Conteúdo do site"],
  ["/admin/produtos", "Produtos"],
  ["/admin/feedbacks", "Feedbacks"],
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) =>
    path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(path);

  const go = (path) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const exit = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div>
          <b>HANIF ALVES</b>
          <span>PAINEL ADMINISTRATIVO</span>
          <small className="admin-version">V4 • CMS COMERCIAL</small>
        </div>

        <nav>
          {items.map(([path, label]) => (
            <button
              type="button"
              key={path}
              className={isActive(path) ? "active" : ""}
              onClick={() => go(path)}
            >
              {label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="admin-public-link"
          onClick={() => navigate("/")}
        >
          Ver site público
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <div>
            <span>ADMINISTRADOR</span>
            <h1>Olá, {profile?.full_name || "Hanif"}</h1>
          </div>
          <button type="button" onClick={exit}>Sair</button>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
