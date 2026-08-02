import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8) return setMessage("Use pelo menos 8 caracteres.");
    if (password !== confirm) return setMessage("As senhas não coincidem.");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) return setMessage(error.message);
    navigate("/minha-area", { replace: true });
  };

  return <div className="auth-page"><form className="auth-card" onSubmit={submit}>
    <span className="auth-kicker">NOVA SENHA</span><h1>Atualize sua senha</h1>
    <label>Nova senha<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label>
    <label>Confirmar senha<input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} required /></label>
    {message && <div className="auth-message error">{message}</div>}
    <button className="auth-primary" disabled={submitting}>{submitting ? "Salvando..." : "Salvar nova senha"}</button>
  </form></div>;
}
