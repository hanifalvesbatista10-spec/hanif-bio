import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function AccountShortcut() {
  const { user, isAdmin } = useAuth();
  const destination = user ? (isAdmin ? "/admin" : "/minha-area") : "/login";
  return (
    <Link className="account-shortcut" to={destination}>
      {user ? "Minha conta" : "Entrar / Criar conta"}
    </Link>
  );
}
