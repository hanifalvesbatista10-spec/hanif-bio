import { useEffect, useRef, useState } from "react";
import { getStoredLead, isValidEmail, isValidWhatsapp, saveRadarLead } from "../../services/leads";

// Popup de cadastro do Radar: abre por cima da página assim que a pessoa entra no Radar e sempre que ela tenta abrir uma
// análise sem ter se cadastrado. O X (ou Esc, ou clicar fora) fecha o popup, mas a análise completa só abre depois do cadastro.
export default function RadarLeadModal({ open, itemId, onClose, onUnlock }) {
  const stored = getStoredLead();
  const [name, setName] = useState(stored?.name || "");
  const [whatsapp, setWhatsapp] = useState(stored?.whatsapp || "");
  const [email, setEmail] = useState(stored?.email || "");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => firstField.current?.focus(), 80);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (trap) return; // campo invisível preenchido: é robô, não libera nem grava
    if (name.trim().length < 2) return setError("Informe seu nome.");
    if (!isValidWhatsapp(whatsapp)) return setError("Informe o WhatsApp com DDD, por exemplo (88) 99999-9999.");
    if (!isValidEmail(email)) return setError("Informe um e-mail válido.");
    if (!consent) return setError("Marque a autorização para continuar.");

    setBusy(true);
    const result = await saveRadarLead({ name, email, whatsapp, itemId });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onUnlock();
  };

  return (
    <div className="rm-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <style>{`
        .rm-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(3,8,15,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:rm-fade .2s ease-out}
        .rm-dialog{position:relative;width:min(460px,100%);max-height:calc(100vh - 32px);overflow-y:auto;box-sizing:border-box;padding:clamp(24px,5vw,36px);border:1px solid rgba(255,255,255,.14);border-radius:var(--radius-md);background:linear-gradient(160deg,#10243b,#0a1626);box-shadow:var(--shadow-soft);color:#fff;animation:rm-rise .25s ease-out}
        .rm-close{position:absolute;top:12px;right:12px;display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:#c3d0dc;cursor:pointer}
        .rm-close:hover,.rm-close:focus-visible{background:rgba(255,255,255,.1);color:#fff;outline:none}
        .rm-title{margin:0 28px 10px;text-align:center;text-transform:uppercase;font-family:var(--font-display);font-size:clamp(1.7rem,6vw,2.2rem);line-height:1.05;letter-spacing:.005em}
        .rm-title em{font-style:normal;color:#f0324a}
        .rm-sub{margin:0 0 20px;text-align:center;color:var(--brand-text-soft);line-height:1.6;font-size:.95rem}
        .rm-form{display:grid;gap:12px}
        .rm-form input[type=text],.rm-form input[type=tel],.rm-form input[type=email]{width:100%;box-sizing:border-box;min-height:50px;padding:0 15px;border:1px solid rgba(255,255,255,.28);border-radius:var(--radius-sm);background:rgba(255,255,255,.07);color:#fff;font:inherit}
        .rm-form input::placeholder{color:#93a7ba}
        .rm-form input:focus{outline:2px solid var(--brand-red);outline-offset:1px;border-color:var(--brand-red)}
        .rm-check{display:flex;gap:11px;align-items:flex-start;margin-top:2px;font-size:.8rem;line-height:1.5;color:var(--brand-text-soft)}
        .rm-check input{margin-top:2px;width:19px;height:19px;flex:none;accent-color:var(--brand-red)}
        .rm-error{padding:10px 13px;border-radius:var(--radius-sm);border:1px solid rgba(240,50,74,.5);background:rgba(214,21,45,.16);color:#ffc2ca;font-size:.88rem;font-weight:700}
        .rm-trap{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
        .rm-submit{width:100%;text-transform:uppercase;letter-spacing:.06em}
        .rm-submit:disabled{opacity:.6;cursor:wait}
        @keyframes rm-fade{from{opacity:0}to{opacity:1}}
        @keyframes rm-rise{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.rm-overlay,.rm-dialog{animation:none}}
      `}</style>

      <div className="rm-dialog" role="dialog" aria-modal="true" aria-labelledby="rm-title">
        <button type="button" className="rm-close" aria-label="Fechar" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 className="rm-title" id="rm-title">Acesse o <em>Radar</em></h2>
        <p className="rm-sub">
          É grátis. Deixe seus dados para ler as análises completas e receber o convite para a comunidade APH Hardcore.
        </p>

        <form className="rm-form" onSubmit={submit} noValidate>
          <input ref={firstField} type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Nome completo" aria-label="Nome completo" required />
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="WhatsApp (88) 99999-9999" aria-label="WhatsApp com DDD" required />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="Melhor e-mail" aria-label="Melhor e-mail" required />
          <div className="rm-trap" aria-hidden="true">
            <label>Não preencha este campo<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
          </div>
          <label className="rm-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Autorizo Hanif Alves a usar meu nome, WhatsApp e e-mail para me enviar conteúdos de APH e o convite da comunidade. Posso pedir
              para sair a qualquer momento. Leia a{" "}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: "#ff9aa8", textDecoration: "underline", textUnderlineOffset: 3 }}>política de privacidade</a>.
            </span>
          </label>
          {error && <div className="rm-error" role="alert">{error}</div>}
          <button type="submit" className="site-btn primary rm-submit" disabled={busy}>{busy ? "Liberando..." : "Acessar o Radar"}</button>
        </form>
      </div>
    </div>
  );
}
