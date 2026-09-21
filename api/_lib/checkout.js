// Utilitários do checkout próprio (Asaas). Roda no servidor (Vercel).
// As chaves vêm de variáveis de ambiente e NUNCA vão para o navegador. A chave de serviço do
// Supabase e a chave do Asaas só existem aqui.
import { timingSafeEqual } from "node:crypto";
import { HttpError, sendJson } from "./mux.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://qgenfhyzobauknptwsex.supabase.co";

const ASAAS_URLS = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
};

// Envolve o handler: método permitido e erros padronizados (mensagem própria do checkout).
export function checkoutHandler(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader("Allow", methods.join(", "));
        throw new HttpError(405, "method_not_allowed", "Método não permitido.");
      }
      await fn(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.code, message: error.message });
      } else {
        console.error("checkout error:", error);
        sendJson(res, 500, { error: "internal_error", message: "Não foi possível concluir. Tente novamente em instantes." });
      }
    }
  };
}

export function sendJsonNoStore(res, status, body) {
  sendJson(res, status, body);
}

export function checkoutConfig() {
  const asaasKey = process.env.ASAAS_API_KEY || "";
  // Chaves do ambiente de testes (sandbox) do Asaas têm "hmlg" no início; ASAAS_ENV força o ambiente.
  const inferred = asaasKey.includes("_hmlg_") ? "sandbox" : "production";
  const asaasEnv = process.env.ASAAS_ENV === "sandbox" || process.env.ASAAS_ENV === "production" ? process.env.ASAAS_ENV : inferred;
  return {
    asaasKey,
    asaasEnv,
    asaasUrl: ASAAS_URLS[asaasEnv],
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || "",
    // InfiniteTag (o nome do app, sem o $): identifica a sua conta no Checkout Integrado da InfinitePay
    infinitepayHandle: String(process.env.INFINITEPAY_HANDLE || "").trim().replace(/^[$]/, ""),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

// Falha cedo e com mensagem clara quando falta configurar alguma variável na Vercel.
export function requireCheckoutConfig(keys) {
  const config = checkoutConfig();
  const names = {
    asaasKey: "ASAAS_API_KEY",
    webhookToken: "ASAAS_WEBHOOK_TOKEN",
    infinitepayHandle: "INFINITEPAY_HANDLE",
    serviceKey: "SUPABASE_SERVICE_ROLE_KEY",
  };
  const missing = keys.filter((key) => !config[key]).map((key) => names[key]);
  if (missing.length > 0) {
    throw new HttpError(503, "checkout_not_configured", `Checkout ainda não configurado no servidor (faltam: ${missing.join(", ")}).`);
  }
  return config;
}

// ---------------------------------------------------------------- Supabase (chave de serviço)

export async function sb(path, { method = "GET", body, prefer } = {}) {
  const { serviceKey } = checkoutConfig();
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(`Supabase ${response.status}: ${typeof data === "string" ? data : data?.message || "erro"}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Usuário logado (opcional): o checkout funciona sem login, mas se houver sessão vinculamos o pedido à conta.
export async function optionalUserId(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || checkoutConfig().serviceKey;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${match[1]}` } });
    if (!response.ok) return null;
    const user = await response.json();
    return user?.id || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Asaas

// Chamada à API do Asaas. A chave vai no cabeçalho access_token (não é Bearer) e o User-Agent é obrigatório.
export async function asaas(path, { method = "GET", body } = {}) {
  const { asaasKey, asaasUrl } = checkoutConfig();
  const response = await fetch(`${asaasUrl}${path}`, {
    method,
    headers: { access_token: asaasKey, "User-Agent": "hanif-bio-checkout", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description = Array.isArray(data?.errors) ? data.errors.map((item) => item.description).join("; ") : "";
    const error = new Error(description || `Asaas ${response.status}`);
    error.status = response.status;
    error.code = data?.errors?.[0]?.code;
    throw error;
  }
  return data;
}

// Compara o token do webhook em tempo constante.
export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

// Data (AAAA-MM-DD) no fuso de Brasília, somando dias.
export function brDate(daysAhead = 0, now = new Date()) {
  const base = new Date(now.getTime() + daysAhead * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(base);
}

// Formas de pagamento do checkout: "online" = Pix ou cartão na página da InfinitePay; "boleto" = Asaas.
export const PROVIDER_BY_METHOD = { online: "infinitepay", boleto: "asaas" };
export const METHODS = { pix: "PIX", boleto: "BOLETO", card: "CREDIT_CARD" };

// Aceita os nomes antigos (pix/card) como "online".
export function normalizeMethod(value) {
  const method = String(value || "").trim();
  if (method === "pix" || method === "card") return "online";
  return PROVIDER_BY_METHOD[method] ? method : "";
}

// Endereço público do site (retorno e aviso de pagamento). SITE_URL tem prioridade.
export function siteUrl(req) {
  const origin = process.env.SITE_URL || req?.headers?.origin || "";
  return /^https?:\/\//.test(origin) ? origin.replace(/\/$/, "") : "";
}

export const METHOD_BY_BILLING = { PIX: "pix", BOLETO: "boleto", CREDIT_CARD: "card" };

// ---------------------------------------------------------------- validações

export function isValidCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

// Preço cobrado: promocional (se houver) ou normal, em centavos. Sempre calculado no servidor.
export function priceInCents(product) {
  const promo = Number(product?.promotional_price);
  const base = Number(product?.price);
  const value = promo > 0 ? promo : base;
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}
