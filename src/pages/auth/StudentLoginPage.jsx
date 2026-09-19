import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function StudentLoginPage() {
  const { user, profile, loading, isBlocked } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user && profile && !isBlocked) {
    const from = location.state?.from;
    return <Navigate to={from && from.startsWith("/minha-area") ? from : "/minha-area"} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setSubmitting(false);
      setMessage(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return;
    }

    setSubmitting(false);
    navigate("/minha-area", { replace: true });
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link className="auth-back" to="/">← Voltar ao site</Link>
        <span className="auth-kicker">ÁREA DO ALUNO</span>
        <h1>Acessar minhas aulas</h1>
        <p>Entre com o e-mail e senha usados no cadastro.</p>

        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>

        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>

        {message && <div className="auth-message error">{message}</div>}

        <button className="auth-primary" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>

        <div className="auth-links">
          <span>Ainda não tem conta?</span>
          <Link to="/cadastro">Criar conta</Link>
        </div>
      </form>
    </div>
  );
}
