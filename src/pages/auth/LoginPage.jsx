import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={isAdmin ? "/admin" : "/minha-area"} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return setMessage(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    navigate(location.state?.from || "/minha-area", { replace: true });
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link className="auth-back" to="/">← Voltar ao site</Link>
        <span className="auth-kicker">ÁREA RESTRITA</span>
        <h1>Entre na sua conta</h1>
        <p>Acesse seus conteúdos, análises e informações liberadas.</p>
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {message && <div className="auth-message error">{message}</div>}
        <button className="auth-primary" disabled={submitting}>{submitting ? "Entrando..." : "Entrar"}</button>
        <div className="auth-links"><Link to="/recuperar-senha">Esqueci minha senha</Link><Link to="/cadastro">Criar conta</Link></div>
      </form>
    </div>
  );
}
