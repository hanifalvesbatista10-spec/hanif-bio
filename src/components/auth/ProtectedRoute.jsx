import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/auth-extra.css";

export default function ProtectedRoute({ children, adminOnly = false, redirectTo = "/admin/login" }) {
  const { user, profile, profileError, loading, isAdmin, isBlocked, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-loading">Validando acesso...</div>;

  if (!user) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // Logado, mas o perfil não carregou: em vez de mandar de volta ao login (e parecer que nada aconteceu),
  // explica o problema e deixa tentar de novo ou sair.
  if (!profile) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <span className="auth-kicker">NÃO FOI POSSÍVEL ENTRAR</span>
          <h1>Erro ao carregar a sua conta</h1>
          <p>{profileError || "Não foi possível carregar os dados da sua conta."} Isso costuma passar ao tentar de novo.</p>
          <button className="auth-primary" type="button" onClick={() => refreshProfile()}>Tentar de novo</button>
          <button className="auth-secondary" type="button" onClick={() => signOut()}>Sair e entrar de novo</button>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return <Navigate to="/bloqueado" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
