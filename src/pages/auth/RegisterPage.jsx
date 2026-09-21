import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { friendlyAuthError, normalizeEmail, passwordProblem } from "../../services/authErrors";
import PasswordField from "../../components/auth/PasswordField";
import "../../styles/auth-extra.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [existing, setExisting] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((old) => ({ ...old, [field]: event.target.value }));
  const redirectTo = `${window.location.origin}/login?confirmado=1`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setExisting(false);
    const email = normalizeEmail(form.email);
    const fullName = form.fullName.trim().replace(/\s+/g, " ");
    if (fullName.split(" ").filter(Boolean).length < 2) return setMessage("Informe o seu nome completo (nome e sobrenome): ele sai no certificado.");
    const problem = passwordProblem(form.password, { email });
    if (problem) return setMessage(problem);
    if (form.password !== form.confirmPassword) return setMessage("As senhas não coincidem.");
    if (!accepted) return setMessage("Marque a caixa de concordância para criar a conta.");

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
    });
    setSubmitting(false);

    if (error) {
      setMessage(friendlyAuthError(error));
      setExisting(/exist|registered/i.test(`${error.message} ${error.code || ""}`));
      return;
    }
    // E-mail já cadastrado: com confirmação de e-mail ligada, o Supabase responde "sucesso" mas sem identidades.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setMessage("Já existe uma conta com este e-mail. Entre com a sua senha ou use “Esqueci minha senha”.");
      setExisting(true);
      return;
    }
    // Confirmação de e-mail desligada: já veio com sessão.
    if (data?.session) {
      navigate("/minha-area", { replace: true });
      return;
    }
    setSentTo(email);
  };

  const resend = async () => {
    setMessage("");
    const { error } = await supabase.auth.resend({ type: "signup", email: sentTo, options: { emailRedirectTo: redirectTo } });
    if (error) return setMessage(friendlyAuthError(error));
    setResent(true);
  };

  if (sentTo) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <span className="auth-kicker">QUASE LÁ</span>
          <h1>Confirme o seu e-mail</h1>
          <p>Enviamos uma mensagem para <strong>{sentTo}</strong>. Clique no link dentro dela para ativar a conta e depois entre com a sua senha.</p>
          <p className="auth-hint">Não chegou? Veja a caixa de <strong>spam</strong> e a aba <strong>Promoções</strong>. Pode levar alguns minutos.</p>
          {message && <div className="auth-message error" role="alert">{message}</div>}
          {resent && <div className="auth-message success" role="status">Enviamos outro e-mail de confirmação.</div>}
          <button type="button" className="auth-secondary" onClick={resend} disabled={resent}>{resent ? "E-mail reenviado" : "Reenviar e-mail"}</button>
          <Link className="auth-cta-link" to="/login">Ir para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link className="auth-back" to="/">← Voltar ao site</Link>
        <span className="auth-kicker">NOVO ALUNO</span>
        <h1>Crie sua conta</h1>
        <p>Use o mesmo e-mail da sua compra: é com ele que o seu curso aparece na conta.</p>
        <label>Nome completo<input value={form.fullName} onChange={update("fullName")} required autoComplete="name" /></label>
        <label>E-mail<input type="email" value={form.email} onChange={update("email")} required autoComplete="email" inputMode="email" autoCapitalize="none" /></label>
        <PasswordField label="Senha" value={form.password} onChange={update("password")} autoComplete="new-password" showStrength />
        <PasswordField label="Confirmar senha" value={form.confirmPassword} onChange={update("confirmPassword")} autoComplete="new-password" />
        <p className="auth-hint">Use pelo menos 8 caracteres, com letras e números.</p>
        <label className="auth-check">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>Concordo em usar os meus dados para o acesso aos cursos, emissão de certificados e contato sobre a minha conta.</span>
        </label>
        {message && <div className="auth-message error" role="alert">{message}</div>}
        {existing && <Link className="auth-secondary auth-cta-secondary" to="/recuperar-senha">Esqueci minha senha</Link>}
        <button className="auth-primary" disabled={submitting}>{submitting ? "Criando..." : "Criar conta"}</button>
        <div className="auth-links"><span>Já possui conta?</span><Link to="/login">Entrar</Link></div>
      </form>
    </div>
  );
}
