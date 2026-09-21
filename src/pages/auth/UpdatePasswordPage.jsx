import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { friendlyAuthError, passwordProblem } from "../../services/authErrors";
import PasswordField from "../../components/auth/PasswordField";
import "../../styles/auth-extra.css";

// O link do e-mail traz a pessoa para cá já com uma sessão temporária de recuperação (o supabase-js lê o link
// sozinho). Sem essa sessão (link vencido, já usado ou aberto em outro lugar) mostramos como pedir outro.
function linkError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const code = hash.get("error_code") || query.get("error_code") || hash.get("error") || query.get("error");
  if (!code) return "";
  return /expired|otp_expired/i.test(`${code} ${hash.get("error_description") || ""}`)
    ? "Este link de recuperação venceu. Os links valem por 1 hora e só podem ser usados uma vez."
    : "Este link de recuperação não é válido (já foi usado ou foi cortado ao copiar).";
}

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | done
  const [invalidReason, setInvalidReason] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const fromLink = linkError();
    if (fromLink) {
      setInvalidReason(fromLink);
      setStatus("invalid");
      return undefined;
    }

    const accept = (session) => {
      if (!active || !session?.user) return;
      setEmail(session.user.email || "");
      setStatus("ready");
    };

    supabase.auth.getSession().then(({ data }) => accept(data.session));
    // o supabase-js pode demorar um instante para trocar o código do link por uma sessão
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") window.setTimeout(() => accept(session), 0);
    });
    const timer = window.setTimeout(() => {
      if (!active) return;
      setStatus((current) => {
        if (current === "checking") setInvalidReason("Não encontramos uma sessão de recuperação. Abra o link direto do e-mail mais recente.");
        return current === "checking" ? "invalid" : current;
      });
    }, 6000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    const problem = passwordProblem(password, { email });
    if (problem) return setMessage(problem);
    if (password !== confirm) return setMessage("As senhas não coincidem.");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      setMessage(friendlyAuthError(error));
      return;
    }
    // senha nova vale só aqui: encerra as outras sessões abertas (quem tinha a senha antiga é desconectado)
    await supabase.auth.signOut({ scope: "others" }).catch(() => null);
    setSubmitting(false);
    setStatus("done");
    window.setTimeout(() => navigate("/minha-area", { replace: true }), 1800);
  };

  if (status === "checking") {
    return <div className="auth-page"><div className="auth-card"><span className="auth-kicker">NOVA SENHA</span><h1>Verificando o link...</h1></div></div>;
  }

  if (status === "invalid") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <span className="auth-kicker">LINK INVÁLIDO</span>
          <h1>Não foi possível redefinir</h1>
          <p>{invalidReason}</p>
          <Link className="auth-cta-link" to="/recuperar-senha">Pedir um novo link</Link>
          <div className="auth-links"><span>Já lembrou a senha?</span><Link to="/login">Entrar</Link></div>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <span className="auth-kicker">PRONTO</span>
          <h1>Senha atualizada!</h1>
          <p>A sua nova senha já vale. Estamos levando você para a área do aluno.</p>
          <Link className="auth-cta-link" to="/minha-area">Ir para minhas aulas</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-kicker">NOVA SENHA</span>
        <h1>Crie a sua nova senha</h1>
        {email && <p>Conta: <strong>{email}</strong></p>}
        <PasswordField label="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" showStrength />
        <PasswordField label="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        <p className="auth-hint">Use pelo menos 8 caracteres, com letras e números.</p>
        {message && <div className="auth-message error" role="alert">{message}</div>}
        <button className="auth-primary" disabled={submitting}>{submitting ? "Salvando..." : "Salvar nova senha"}</button>
      </form>
    </div>
  );
}
