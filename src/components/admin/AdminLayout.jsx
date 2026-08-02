import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const items = [
  ["/admin", "Visão geral", true],
  ["/admin/usuarios", "Usuários"],
  ["/admin/feedbacks", "Feedbacks"],
  ["/admin/analises", "Análises"],
  ["/admin/produtos", "Produtos"],
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div><b>HANIF ALVES</b><span>PAINEL ADMINISTRATIVO</span></div>
        <nav>
          {items.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={Boolean(end)} className={({ isActive }) => isActive ? "active" : ""}>
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/">Ver site público</NavLink>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <div><span>ADMINISTRADOR</span><h1>Olá, {profile?.full_name || "Hanif"}</h1></div>
          <button onClick={signOut}>Sair</button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
