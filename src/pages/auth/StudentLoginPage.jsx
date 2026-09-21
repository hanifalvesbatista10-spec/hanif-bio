import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { friendlyAuthError, normalizeEmail } from "../../services/authErrors";
import PasswordField from "../../components/auth/PasswordField";
import "../../styles/auth-extra.css";

const MAX_FAILURES = 5;
const COOLDOWN_SECONDS = 30;

export default function StudentLoginPage() {
  const { user, profile, loading, isBlocked } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failures, setFailures] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const banner = params.get("confirmado")
    ? "E-mail confirmado! Agora é só entrar com a sua senha."
    : params.get("senha")
      ? "Senha atualizada com sucesso. Entre com a nova senha."
      : params.get("cadastro")
        ? "Conta criada. Entre com o e-mail e a senha que você cadastrou."
        : "";

  // depois de várias tentativas erradas, espera alguns segundos (o servidor também limita)
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!loading && user && profile && !isBlocked) {
    const from = location.state?.from;
    return <Navigate to={from && from.startsWith("/minha-area") ? from : "/minha-area"} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (cooldown > 0) return;
    setSubmitting(true);
    setMessage("");
    setNeedsConfirmation(false);
    setResent(false);

    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });

    if (error) {
      setSubmitting(false);
      setMessage(friendlyAuthError(error));
      setNeedsConfirmation(/confirm/i.test(`${error.message} ${error.code || ""}`));
      const next = failures + 1;
      setFailures(next);
      if (next >= MAX_FAILURES) {
        setCooldown(COOLDOWN_SECONDS);
        setFailures(0);
      }
      return;
    }

    setSubmitting(false);
    const from = location.state?.from;
    navigate(from && from.startsWith("/minha-area") ? from : "/minha-area", { replace: true });
  };

  const resend = async () => {
    setMessage("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
      options: { emailRedirectTo: `${window.location.origin}/login?confirmado=1` },
    });
    if (error) return setMessage(friendlyAuthError(error));
    setResent(true);
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link className="auth-back" to="/">← Voltar ao site</Link>
        <span className="auth-kicker">ÁREA DO ALUNO</span>
        <h1>Acessar minhas aulas</h1>
        <p>Entre com o e-mail e a senha do seu cadastro.</p>

        {banner && <div className="auth-message success" role="status">{banner}</div>}

        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" autoCapitalize="none" />
        </label>

        <PasswordField label="Senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <Link className="auth-forgot" to="/recuperar-senha">Esqueci minha senha</Link>

        {message && <div className="auth-message error" role="alert">{message}</div>}
        {needsConfirmation && (
          <>
            <button type="button" className="auth-secondary" onClick={resend} disabled={!email || resent}>
              {resent ? "E-mail reenviado" : "Reenviar e-mail de confirmação"}
            </button>
            {resent && <div className="auth-message success" role="status">Enviamos um novo e-mail de confirmação. Confira também a caixa de spam.</div>}
          </>
        )}

        <button className="auth-primary" disabled={submitting || cooldown > 0}>
          {submitting ? "Entrando..." : cooldown > 0 ? `Aguarde ${cooldown}s` : "Entrar"}
        </button>

        <div className="auth-links">
          <span>Ainda não tem conta?</span>
          <Link to="/cadastro">Criar conta</Link>
        </div>
      </form>
    </div>
  );
}
