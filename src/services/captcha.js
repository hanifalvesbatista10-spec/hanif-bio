// Verificação "não sou um robô" (Cloudflare Turnstile) para entrar, criar conta e recuperar senha.
//
// Como funciona: antes de chamar o Supabase Auth, a tela pede um comprovante (`getCaptchaToken`). Uma janelinha abre, o
// Turnstile confere sozinho (quase sempre sem o usuário fazer nada) e o comprovante vai em `options.captchaToken`. Quando o
// CAPTCHA está ligado no Supabase (Authentication > Attack Protection), o servidor confere o comprovante em toda chamada de
// login, cadastro, reenvio de e-mail e recuperação de senha; sem ele, a chamada é recusada.
//
// Sem VITE_TURNSTILE_SITE_KEY nada disso aparece e o fluxo é o de antes (deploy seguro antes de ligar no Supabase).
// Cada comprovante vale uma vez só: peça um novo a cada chamada.
import "../styles/captcha.css";

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY);

const UNAVAILABLE =
  "Não foi possível carregar a verificação de segurança. Desative bloqueadores de anúncios para este site ou tente outro navegador e tente de novo.";

let scriptPromise = null;

// Carrega o script da Cloudflare uma vez (pode ser chamado antes, para adiantar).
export function loadTurnstile() {
  if (!captchaEnabled) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
      script.onerror = () => {
        scriptPromise = null; // permite tentar de novo
        script.remove();
        reject(new Error("turnstile"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// Abre a janelinha, espera o comprovante e fecha. Devolve { ok: true, token } ou { ok: false, message }.
// Com o CAPTCHA desligado devolve { ok: true, token: undefined } na hora.
export function getCaptchaToken() {
  if (!captchaEnabled) return Promise.resolve({ ok: true, token: undefined });

  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const el = (tag, className, content) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (content) node.textContent = content;
      return node;
    };
    const overlay = el("div", "cf-overlay");
    const card = el("div", "cf-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "cf-title");
    const title = el("h2", "", "Verificação de segurança");
    title.id = "cf-title";
    const text = el("p", "cf-text", "Confirmando que você não é um robô…");
    text.setAttribute("role", "status");
    const box = el("div", "cf-widget");
    const actions = el("div", "cf-actions");
    const retry = el("button", "cf-retry", "Tentar de novo");
    retry.type = "button";
    retry.hidden = true;
    const cancel = el("button", "cf-cancel", "Cancelar");
    cancel.type = "button";
    actions.append(retry, cancel);
    card.append(title, text, box, actions);
    overlay.append(card);
    document.body.appendChild(overlay);
    let widgetId = null;
    let done = false;
    let api = null;

    const finish = (result) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      try {
        if (api && widgetId !== null) api.remove(widgetId);
      } catch {
        /* o widget já saiu */
      }
      overlay.remove();
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === "Escape") finish({ ok: false, message: "" });
    };
    document.addEventListener("keydown", onKey);
    cancel.addEventListener("click", () => finish({ ok: false, message: "" }));
    cancel.focus();

    const showError = (message) => {
      text.textContent = message;
      retry.hidden = false;
      retry.focus();
    };

    const render = (turnstile) => {
      api = turnstile;
      retry.hidden = true;
      text.textContent = "Confirmando que você não é um robô…";
      if (widgetId !== null) {
        try {
          turnstile.remove(widgetId);
        } catch {
          /* ignora */
        }
        box.innerHTML = "";
      }
      widgetId = turnstile.render(box, {
        sitekey: TURNSTILE_SITE_KEY,
        language: "pt-br",
        theme: "light",
        callback: (token) => finish({ ok: true, token }),
        "error-callback": () => {
          showError("A verificação falhou. Confira a conexão e tente de novo.");
          return true; // já tratamos o erro
        },
        "timeout-callback": () => showError("A verificação demorou demais. Tente de novo."),
        "expired-callback": () => showError("A verificação expirou. Tente de novo."),
      });
    };

    retry.addEventListener("click", () => {
      loadTurnstile().then(render, () => showError(UNAVAILABLE));
    });

    loadTurnstile().then(render, () => showError(UNAVAILABLE));
  });
}

// O servidor recusou o comprovante (por exemplo, expirou antes do envio).
export const isCaptchaError = (error) => {
  const raw = String(error?.message || error || "").toLowerCase();
  return String(error?.code || "").toLowerCase() === "captcha_failed" || raw.includes("captcha");
};
