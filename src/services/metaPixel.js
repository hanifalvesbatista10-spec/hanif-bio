// Pixel da Meta no navegador. Regras:
//  - só carrega DEPOIS que o visitante aceita os cookies de anúncios (veja consent.js); sem aceite, nada é baixado;
//  - nunca roda no painel de administração nem na área do aluno;
//  - a captura automática de cliques/formulários da Meta fica desligada (só mandamos os eventos abaixo);
//  - Purchase usa o id do pedido como eventID, o mesmo que o servidor manda pela API de Conversões, então a Meta
//    conta uma venda só.
// O ID do Pixel vem de VITE_META_PIXEL_ID. Sem ele, tudo aqui é ignorado.
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;
const FBCLID_KEY = "ha_fbclid";
const PURCHASE_KEY = "ha_meta_purchase_";
const READY_EVENT = "ha:meta-pixel-ready";

let loaded = false;

export const isPrivatePath = (pathname = typeof window !== "undefined" ? window.location.pathname : "") => /^\/(admin|minha-area)(\/|$)/.test(pathname);

export const isMetaPixelLoaded = () => loaded;

function safeStorage(action) {
  try {
    return action();
  } catch {
    return null;
  }
}

// Guarda o fbclid da URL (anúncio) para montar o _fbc se o cookie ainda não existir na hora da compra.
function captureFbclid() {
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (fbclid && /^[\w-]{1,200}$/.test(fbclid)) {
    safeStorage(() => localStorage.setItem(FBCLID_KEY, JSON.stringify({ id: fbclid, ts: Date.now() })));
  }
}

export function loadMetaPixel() {
  if (!PIXEL_ID || loaded || typeof window === "undefined" || isPrivatePath()) return;
  loaded = true;
  captureFbclid();

  // snippet oficial da Meta (cria a fila fbq e baixa fbevents.js de forma assíncrona: não trava a página)
  /* eslint-disable */
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("set", "autoConfig", false, PIXEL_ID);
  window.fbq("init", PIXEL_ID);
  trackPageView();
  window.dispatchEvent(new Event(READY_EVENT));
}

// Roda "callback" agora se o Pixel já está carregado; se não, roda assim que ele carregar (por exemplo, quando o visitante
// aceita o banner de cookies com a página do curso já aberta). Devolve a função que cancela a espera.
export function onMetaPixelReady(callback) {
  if (loaded) {
    callback();
    return () => {};
  }
  window.addEventListener(READY_EVENT, callback, { once: true });
  return () => window.removeEventListener(READY_EVENT, callback);
}

export function trackPageView() {
  if (!loaded || isPrivatePath()) return;
  try {
    window.fbq("track", "PageView");
  } catch {
    // o Pixel nunca pode quebrar o site
  }
}

export function trackMeta(eventName, data, options) {
  if (!loaded || isPrivatePath()) return;
  try {
    options ? window.fbq("track", eventName, data, options) : window.fbq("track", eventName, data);
  } catch {
    // idem
  }
}

const readCookie = (name) => {
  const match = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

// Dados que o servidor guarda no pedido para a API de Conversões. Só há consentimento se o Pixel foi carregado.
export function getMetaTrackingData() {
  if (!loaded) return { consent: false };
  let fbc = readCookie("_fbc");
  if (!fbc) {
    const stored = safeStorage(() => JSON.parse(localStorage.getItem(FBCLID_KEY) || "null"));
    if (stored?.id) fbc = `fb.1.${stored.ts}.${stored.id}`;
  }
  return { consent: true, fbp: readCookie("_fbp"), fbc, url: window.location.href };
}

const contentFor = (product) => ({
  content_ids: [product.id],
  content_type: "product",
  content_name: product.title,
  value: Number(product.promotional_price ?? product.price) || 0,
  currency: "BRL",
});

export const trackViewContent = (product) => product?.id && trackMeta("ViewContent", contentFor(product));
export const trackInitiateCheckout = (product, valueCents) =>
  product?.id && trackMeta("InitiateCheckout", { ...contentFor(product), value: Number(valueCents) / 100 });

// Compra confirmada. Dispara uma vez por pedido neste navegador; valor = o que foi realmente pago (já com cupom). Pedido
// grátis (valor 0) não envia nada.
export function reportMetaPurchase({ orderId, amountCents, contentIds }) {
  if (!loaded || !orderId || !(Number(amountCents) > 0)) return;
  if (safeStorage(() => localStorage.getItem(`${PURCHASE_KEY}${orderId}`))) return;
  trackMeta(
    "Purchase",
    { value: Number(amountCents) / 100, currency: "BRL", content_ids: contentIds || [], content_type: "product", num_items: (contentIds || []).length },
    { eventID: orderId }
  );
  safeStorage(() => localStorage.setItem(`${PURCHASE_KEY}${orderId}`, "1"));
}
