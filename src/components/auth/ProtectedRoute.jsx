import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading, isAdmin, isBlocked } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-loading">Validando acesso administrativo...</div>;

  if (!user) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (isBlocked || !profile || (adminOnly && !isAdmin)) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
