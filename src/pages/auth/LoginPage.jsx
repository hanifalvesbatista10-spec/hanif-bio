import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginPage() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setSubmitting(false);
      setMessage(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message
      );
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,account_status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      profile.account_status !== "active"
    ) {
      await signOut();
      setSubmitting(false);
      setMessage("Esta conta não possui acesso administrativo.");
      return;
    }

    setSubmitting(false);
    navigate("/admin", { replace: true });
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link className="auth-back" to="/">← Voltar ao site</Link>
        <span className="auth-kicker">ACESSO ADMINISTRATIVO</span>
        <h1>Painel de gestão</h1>
        <p>Área exclusiva para administração do site, produtos e feedbacks.</p>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {message && <div className="auth-message error">{message}</div>}

        <button className="auth-primary" disabled={submitting}>
          {submitting ? "Validando acesso..." : "Entrar no painel"}
        </button>

        <div className="auth-links" style={{ justifyContent: "center" }}>
          <span>Não existe cadastro público neste site.</span>
        </div>
      </form>
    </div>
  );
}
