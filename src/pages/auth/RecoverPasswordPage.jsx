import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { friendlyAuthError, normalizeEmail } from "../../services/authErrors";
import "../../styles/auth-extra.css";

const RESEND_SECONDS = 60;

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const submit = async (event) => {
    event.preventDefault();
    if (wait > 0) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    const clean = normalizeEmail(email);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: `${window.location.origin}/atualizar-senha`,
    });
    setSubmitting(false);
    if (requestError) {
      setError(friendlyAuthError(requestError));
      return;
    }
    // Mensagem neutra de propósito: não revela se o e-mail tem conta ou não.
    setSent(true);
    setWait(RESEND_SECONDS);
    setMessage("Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora.");
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Link className="auth-back" to="/login">← Voltar ao login</Link>
        <span className="auth-kicker">RECUPERAÇÃO</span>
        <h1>Esqueci minha senha</h1>
        <p>Digite o e-mail do seu cadastro. Vamos enviar um link para você criar uma nova senha.</p>

        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" autoCapitalize="none" disabled={submitting} />
        </label>

        {error && <div className="auth-message error" role="alert">{error}</div>}
        {message && <div className="auth-message success" role="status">{message}</div>}
        {sent && (
          <p className="auth-hint">
            Não chegou? Veja a caixa de <strong>spam</strong> e a aba <strong>Promoções</strong>. O e-mail pode levar alguns minutos.
            Você pode pedir outro link {wait > 0 ? `em ${wait}s` : "agora"}.
          </p>
        )}

        <button className="auth-primary" disabled={submitting || wait > 0}>
          {submitting ? "Enviando..." : wait > 0 ? `Reenviar em ${wait}s` : sent ? "Enviar outro link" : "Enviar link"}
        </button>

        <div className="auth-links">
          <span>Lembrou a senha?</span>
          <Link to="/login">Entrar</Link>
        </div>
      </form>
    </div>
  );
}
