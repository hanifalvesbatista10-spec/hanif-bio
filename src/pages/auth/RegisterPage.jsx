import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((old) => ({ ...old, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (form.password.length < 8) return setMessage("A senha precisa ter pelo menos 8 caracteres.");
    if (form.password !== form.confirmPassword) return setMessage("As senhas não coincidem.");
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    });
    setSubmitting(false);
    if (error) return setMessage(error.message);
    setSuccess(true);
    setMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro.");
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link className="auth-back" to="/">← Voltar ao site</Link>
        <span className="auth-kicker">NOVO ALUNO</span>
        <h1>Crie sua conta</h1>
        <p>Seu cadastro será criado automaticamente como aluno. Permissões administrativas não ficam disponíveis no cadastro público.</p>
        <label>Nome completo<input value={form.fullName} onChange={update("fullName")} required /></label>
        <label>E-mail<input type="email" value={form.email} onChange={update("email")} required /></label>
        <label>Senha<input type="password" value={form.password} onChange={update("password")} required /></label>
        <label>Confirmar senha<input type="password" value={form.confirmPassword} onChange={update("confirmPassword")} required /></label>
        {message && <div className={`auth-message ${success ? "success" : "error"}`}>{message}</div>}
        <button className="auth-primary" disabled={submitting || success}>{submitting ? "Criando..." : success ? "Conta criada" : "Criar conta"}</button>
        <div className="auth-links"><span>Já possui conta?</span><Link to="/login">Entrar</Link></div>
      </form>
    </div>
  );
}
