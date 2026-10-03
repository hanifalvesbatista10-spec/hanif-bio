import { useState } from "react";
import { Link } from "react-router-dom";
import { TOPIC_LABELS } from "../../services/radar";
import { getStoredLead, isValidEmail, isValidWhatsapp, saveRadarLead } from "../../services/leads";

// Tela de cadastro que vem antes da análise completa do Radar. O título e o resumo ficam visíveis (vitrine); a
// leitura completa é liberada depois que a pessoa deixa nome, WhatsApp e e-mail.
export default function RadarLeadGate({ item, onUnlock }) {
  const stored = getStoredLead();
  const [name, setName] = useState(stored?.name || "");
  const [whatsapp, setWhatsapp] = useState(stored?.whatsapp || "");
  const [email, setEmail] = useState(stored?.email || "");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (trap) return; // campo invisível preenchido: é robô, não libera nem grava
    if (name.trim().length < 2) return setError("Informe seu nome.");
    if (!isValidWhatsapp(whatsapp)) return setError("Informe o WhatsApp com DDD, por exemplo (88) 99999-9999.");
    if (!isValidEmail(email)) return setError("Informe um e-mail válido.");
    if (!consent) return setError("Marque a autorização para continuar.");

    setBusy(true);
    const result = await saveRadarLead({ name, email, whatsapp, itemId: item.id });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onUnlock();
  };

  return (
    <div className="site-container" style={{ maxWidth: 820 }}>
      <style>{`
        .rg-form{display:grid;gap:14px;margin-top:22px;padding:22px;border:1px solid var(--brand-border,#d6e0e9);border-radius:18px;background:var(--brand-surface,#fff)}
        .rg-form h3{margin:0;font-size:1.2rem}
        .rg-form p{margin:0;color:var(--brand-text-soft);line-height:1.6}
        .rg-form label{display:grid;gap:6px;font-weight:700;font-size:.88rem}
        .rg-form input[type=text],.rg-form input[type=tel],.rg-form input[type=email]{width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid var(--brand-border,#cfd9e3);border-radius:12px;font:inherit;font-weight:400;color:inherit;background:#fff}
        .rg-check{display:flex!important;grid-template-columns:none!important;gap:10px!important;align-items:flex-start;font-weight:400!important;font-size:.82rem!important;line-height:1.5;color:var(--brand-text-soft)}
        .rg-check input{margin-top:3px;width:18px;height:18px;flex:none;accent-color:var(--brand-red,#d6152d)}
        .rg-error{padding:10px 12px;border-radius:10px;background:#fff0f2;color:#a60d25;font-size:.88rem;font-weight:700}
        .rg-trap{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
      `}</style>

      <Link className="site-about-link" to="/radar">← Voltar ao Radar</Link>
      <span className="site-eyebrow" style={{ display: "block", marginTop: 18 }}>{TOPIC_LABELS[item.topic] || "Radar de Evidências"}</span>
      <h1 style={{ margin: "8px 0 14px", fontSize: "clamp(1.8rem,4vw,2.6rem)", lineHeight: 1.15 }}>{item.title_pt || item.title_original}</h1>
      <p style={{ margin: 0, color: "var(--brand-text-soft)", lineHeight: 1.75 }}>{item.summary_pt}</p>

      <form className="rg-form" onSubmit={submit} noValidate>
        <h3>Leia a análise completa, grátis</h3>
        <p>
          É gratuito. Em troca, deixe seus dados: eles liberam a leitura e você recebe o convite para a comunidade APH Hardcore, onde
          essas novidades são discutidas.
        </p>
        <label>Nome
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
        </label>
        <label>WhatsApp (com DDD)
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="(88) 99999-9999" required />
        </label>
        <label>Melhor e-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
        </label>
        <div className="rg-trap" aria-hidden="true">
          <label>Não preencha este campo<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
        </div>
        <label className="rg-check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Autorizo Hanif Alves a usar meu nome, WhatsApp e e-mail para me enviar conteúdos de APH e o convite da comunidade. Posso
            pedir para sair a qualquer momento.
          </span>
        </label>
        {error && <div className="rg-error" role="alert">{error}</div>}
        <button type="submit" className="site-buy" disabled={busy} style={{ justifySelf: "start" }}>
          {busy ? "Liberando..." : "Liberar a análise completa"}
        </button>
      </form>
    </div>
  );
}
