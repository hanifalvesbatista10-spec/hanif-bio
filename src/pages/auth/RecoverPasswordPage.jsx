import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/atualizar-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setSubmitting(false);
    setMessage(error ? error.message : "Enviamos um link de recuperação para o seu e-mail.");
  };

  return <div className="auth-page"><form className="auth-card" onSubmit={submit}>
    <Link className="auth-back" to="/login">← Voltar ao login</Link>
    <span className="auth-kicker">RECUPERAÇÃO</span><h1>Recuperar senha</h1><p>Digite o e-mail utilizado no cadastro.</p>
    <label>E-mail<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
    {message && <div className="auth-message success">{message}</div>}
    <button className="auth-primary" disabled={submitting}>{submitting ? "Enviando..." : "Enviar link"}</button>
  </form></div>;
}
