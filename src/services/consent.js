// Consentimento de cookies. A etiqueta do Google Ads só é carregada DEPOIS que o visitante aceita: antes disso ela
// nem existe na página (window.gtag fica indefinido), então nenhum cookie nem requisição do Google acontece, e a
// conversão de compra (adsConversion.js) também não dispara. A escolha fica guardada neste navegador.
const STORAGE_KEY = "ha_cookie_consent_v1";
const ADS_ID = "AW-18404535998";

export const OPEN_PREFERENCES_EVENT = "ha:open-cookie-preferences";

export function getConsent() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return value && typeof value.marketing === "boolean" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(marketing) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ marketing, at: new Date().toISOString() }));
  } catch {
    // sem armazenamento (modo privado): a escolha vale só até fechar a página
  }
}

let adsLoaded = false;

export function loadGoogleAds() {
  if (adsLoaded || typeof document === "undefined") return;
  adsLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", ADS_ID);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`;
  document.head.appendChild(script);
}

// Chamado na abertura do site: quem já aceitou antes continua sendo medido, quem recusou ou ainda não escolheu, não.
export function initConsent() {
  if (getConsent()?.marketing) loadGoogleAds();
}

// Ao revogar o consentimento, apaga os cookies de anúncios do Google deste site.
export function clearAdsCookies() {
  const hosts = [location.hostname, `.${location.hostname.replace(/^www\./, "")}`];
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    if (!/^(_gcl_|_gac_|_gads|_gpi)/.test(name)) return;
    hosts.forEach((host) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${host}`;
    });
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

export const openCookiePreferences = () => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
