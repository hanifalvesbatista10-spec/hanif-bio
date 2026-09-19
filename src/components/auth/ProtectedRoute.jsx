import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false, redirectTo = "/admin/login" }) {
  const { user, profile, loading, isAdmin, isBlocked } = useAuth();
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

  if (isBlocked) {
    return <Navigate to="/bloqueado" replace />;
  }

  if (!profile || (adminOnly && !isAdmin)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
