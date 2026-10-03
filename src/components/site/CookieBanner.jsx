import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { OPEN_PREFERENCES_EVENT, clearAdsCookies, getConsent, loadGoogleAds, setConsent } from "../../services/consent";

// Aviso de cookies: aparece na primeira visita e pode ser reaberto por "Preferências de cookies" no rodapé.
// Não aparece no painel de administração.
export default function CookieBanner() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => getConsent() === null);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, reopen);
  }, []);

  if (!open || pathname.startsWith("/admin")) return null;

  const choose = (marketing) => {
    const hadAccepted = Boolean(getConsent()?.marketing);
    setConsent(marketing);
    setOpen(false);
    if (marketing) {
      loadGoogleAds();
    } else if (hadAccepted) {
      // quem tinha aceitado e agora recusa: limpa os cookies e recarrega para a etiqueta sair da página
      clearAdsCookies();
      window.location.reload();
    }
  };

  return (
    <div className="ck-banner" role="region" aria-label="Aviso de cookies">
      <style>{`
        .ck-banner{position:fixed;left:0;right:0;bottom:0;z-index:900;display:flex;gap:16px 24px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:16px max(16px,calc((100vw - 1120px)/2));padding-bottom:max(16px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.14);background:rgba(7,20,38,.97);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 -16px 40px rgba(0,0,0,.35);color:#fff;font-family:var(--font-sans)}
        .ck-banner p{margin:0;flex:1 1 380px;color:#c3d0dc;font-size:.9rem;line-height:1.55}
        .ck-banner a{color:#ff9aa8;text-decoration:underline;text-underline-offset:3px}
        .ck-banner .ck-actions{display:flex;gap:10px;flex:0 0 auto}
        .ck-banner .site-btn{min-height:44px;padding:0 20px;font-size:.9rem}
        @media(max-width:600px){.ck-banner .ck-actions{width:100%}.ck-banner .site-btn{flex:1}}
      `}</style>
      <p>
        Usamos cookies essenciais para o site funcionar. Com a sua permissão, usamos também cookies do Google Ads para medir se nossos anúncios
        funcionam. Você pode mudar a escolha quando quiser. Saiba mais na <a href="/privacidade">política de privacidade</a>.
      </p>
      <div className="ck-actions">
        <button type="button" className="site-btn secondary" onClick={() => choose(false)}>Recusar</button>
        <button type="button" className="site-btn primary" onClick={() => choose(true)}>Aceitar</button>
      </div>
    </div>
  );
}
