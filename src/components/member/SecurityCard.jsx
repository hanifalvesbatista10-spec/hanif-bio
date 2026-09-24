import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { friendlyAuthError, passwordProblem } from "../../services/authErrors";
import PasswordField from "../auth/PasswordField";

// Aba "Segurança": e-mail de acesso, "Alterar senha" (pede a atual) e "Sair de todos os aparelhos".
export default function SecurityCard() {
  const { user, signOutEverywhere } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(params.get("alterar") === "1");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  // O atalho "Alterar senha" do menu da conta abre o formulário direto.
  useEffect(() => {
    if (params.get("alterar") === "1") setEditing(true);
  }, [params]);

  useEffect(() => {
    if (editing) formRef.current?.querySelector("input")?.focus();
  }, [editing]);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const closeForm = () => {
    setEditing(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    if (params.get("alterar")) {
      const rest = new URLSearchParams(params);
      rest.delete("alterar");
      setParams(rest, { replace: true });
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    const problem = passwordProblem(next, { email: user?.email });
    if (problem) return notify("error", problem);
    if (next !== confirm) return notify("error", "A nova senha e a confirmação são diferentes.");
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
    closeForm();
    notify("success", "Senha alterada. Desconectamos os outros aparelhos em que você estava logado.");
  };

  const leaveEverywhere = async () => {
    if (!window.confirm("Sair de todos os aparelhos, inclusive deste? Você vai precisar entrar de novo.")) return;
    await signOutEverywhere();
    navigate("/login", { replace: true });
  };

  return (
    <section className="mb-card" aria-labelledby="mb-sec-title">
      <div className="mb-card-head">
        <h2 id="mb-sec-title">Segurança</h2>
        <p>Cuide do acesso à sua conta.</p>
      </div>

      {message && !editing && <div className={`mb-alert ${messageType === "error" ? "is-error" : "is-success"}`} role={messageType === "error" ? "alert" : "status"}>{message}</div>}

      <div className="mb-setting">
        <div>
          <h3>E-mail de acesso</h3>
          <p>{user?.email}</p>
        </div>
      </div>

      <div className="mb-setting">
        <div>
          <h3>Senha</h3>
          <p>Você pode trocar quando quiser. Pedimos a senha atual para confirmar que é você.</p>
        </div>
        {!editing && <button type="button" className="mb-btn is-ghost" onClick={() => { setMessage(""); setEditing(true); }}>Alterar senha</button>}
      </div>

      {editing && (
        <form className="mb-pw-form" ref={formRef} onSubmit={changePassword}>
          {message && <div className={`mb-alert ${messageType === "error" ? "is-error" : "is-success"}`} role="alert">{message}</div>}
          <PasswordField label="Senha atual" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" id="sec-current" />
          <PasswordField label="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" showStrength id="sec-next" />
          <PasswordField label="Repita a nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" id="sec-confirm" />
          <div className="mb-actions">
            <button className="mb-btn" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar nova senha"}</button>
            <button className="mb-btn is-ghost" type="button" onClick={() => { setMessage(""); closeForm(); }} disabled={saving}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="mb-setting">
        <div>
          <h3>Aparelhos conectados</h3>
          <p>Perdeu o celular ou entrou em um computador que não é seu? Encerre todas as sessões abertas.</p>
        </div>
        <button type="button" className="mb-btn is-ghost is-danger" onClick={leaveEverywhere}>Sair de todos os aparelhos</button>
      </div>
    </section>
  );
}
