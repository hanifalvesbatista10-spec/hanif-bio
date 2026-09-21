import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { friendlyAuthError, passwordProblem } from "../../services/authErrors";
import PasswordField from "../auth/PasswordField";
import "../../styles/auth-extra.css";

// "Segurança" na área do aluno: trocar a senha (pedindo a atual) e sair de todos os aparelhos.
export default function SecurityCard() {
  const { user, signOutEverywhere } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [saving, setSaving] = useState(false);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    const problem = passwordProblem(next, { email: user?.email });
    if (problem) return notify("error", problem);
    if (next !== confirm) return notify("error", "A nova senha e a confirmação não coincidem.");
    if (next === current) return notify("error", "A nova senha precisa ser diferente da atual.");

    setSaving(true);
    // confere a senha atual antes de trocar (protege se alguém usar o computador aberto)
    const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (checkError) {
      setSaving(false);
      return notify("error", /invalid/i.test(checkError.message) ? "A senha atual está incorreta." : friendlyAuthError(checkError));
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setSaving(false);
      return notify("error", friendlyAuthError(error));
    }
    await supabase.auth.signOut({ scope: "others" }).catch(() => null);
    setSaving(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    notify("success", "Senha alterada. Os outros aparelhos conectados foram desconectados.");
  };

  const leaveEverywhere = async () => {
    if (!window.confirm("Sair de todos os aparelhos, inclusive deste? Você precisará entrar de novo.")) return;
    await signOutEverywhere();
    navigate("/login", { replace: true });
  };

  return (
    <section className="portal-list sp-card sec-card" aria-label="Segurança da conta">
      <h2>Segurança</h2>
      <form onSubmit={changePassword}>
        <p className="sp-intro">Troque a sua senha quando quiser. Por segurança, pedimos a senha atual.</p>
        {message && <div className={`auth-message ${messageType}`} role="status">{message}</div>}
        <div className="sec-grid">
          <PasswordField label="Senha atual" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" id="sec-current" />
          <PasswordField label="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" showStrength id="sec-next" />
          <PasswordField label="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" id="sec-confirm" />
        </div>
        <button className="auth-primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Alterar senha"}</button>
      </form>
      <hr className="sec-divider" />
      <p className="sp-intro">Perdeu o celular ou entrou em um computador que não é seu? Encerre todas as sessões abertas.</p>
      <button className="auth-secondary" type="button" onClick={leaveEverywhere}>Sair de todos os aparelhos</button>
    </section>
  );
}
