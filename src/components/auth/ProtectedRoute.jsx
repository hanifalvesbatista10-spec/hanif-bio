import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading, isAdmin, isBlocked } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-loading">Carregando sua conta...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (isBlocked) return <Navigate to="/conta-bloqueada" replace />;
  if (!profile) return <div className="auth-loading">Finalizando seu perfil...</div>;
  if (adminOnly && !isAdmin) return <Navigate to="/minha-area" replace />;

  return children;
}
