// API de Conversões da Meta (envio da compra pelo servidor). Regras:
//  - só envia se o comprador aceitou os cookies de anúncios (orders.meta_consent) e o pedido foi realmente pago;
//  - pedido grátis (valor 0) não gera Purchase;
//  - UM envio por pedido: orders.meta_capi_sent_at é "reservado" antes de enviar, então webhook repetido não duplica;
//  - o mesmo event_id do navegador (o id do pedido) faz a Meta contar uma venda só;
//  - qualquer falha vira log + orders.meta_capi_error. Nunca derruba o webhook nem o checkout.
// O token fica só no servidor (META_CAPI_TOKEN) e nunca entra em log nem em resposta.
import { createHash } from "node:crypto";
import { sb, siteUrl } from "./checkout.js";

export const GRAPH_VERSION = "v25.0";
const TIMEOUT_MS = 4000;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();

// e-mail: minúsculo e sem espaços
export function hashEmail(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized ? sha256(normalized) : null;
}

// telefone: só dígitos, com 55 na frente quando vier sem o código do país (DDD + número)
export function hashPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 ? sha256(digits) : null;
}

// nome: minúsculo, só letras
const cleanName = (value) => String(value || "").toLowerCase().replace(/[^\p{L}\p{M}]/gu, "");

export function hashNames(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  const first = cleanName(parts[0]);
  const last = parts.length > 1 ? cleanName(parts[parts.length - 1]) : "";
  return { fn: first ? sha256(first) : null, ln: last ? sha256(last) : null };
}

export const hashId = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized ? sha256(normalized) : null;
};

// Evento Purchase no formato da API. "order" precisa vir completo do banco.
export function buildPurchaseEvent(order, { baseUrl = "", nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  const { fn, ln } = hashNames(order.buyer_name);
  const userData = {
    em: [hashEmail(order.buyer_email)],
    ph: [hashPhone(order.buyer_phone)],
    fn: [fn],
    ln: [ln],
    external_id: [hashId(order.user_id || order.buyer_email)],
  };
  // arrays com valor nulo (dado ausente) saem do evento
  for (const key of Object.keys(userData)) {
    userData[key] = userData[key].filter(Boolean);
    if (userData[key].length === 0) delete userData[key];
  }
  // estes quatro vão SEM hash, como a Meta pede
  if (order.meta_fbp) userData.fbp = order.meta_fbp;
  if (order.meta_fbc) userData.fbc = order.meta_fbc;
  if (order.meta_client_ip) userData.client_ip_address = order.meta_client_ip;
  if (order.meta_user_agent) userData.client_user_agent = order.meta_user_agent;

  const contentIds = [order.product_id, ...(order.bump_product_ids || [])].filter(Boolean);
  return {
    event_name: "Purchase",
    event_time: nowSeconds,
    event_id: order.id,
    action_source: "website",
    event_source_url: order.meta_event_url || baseUrl || undefined,
    user_data: userData,
    custom_data: {
      value: Number(order.amount_cents) / 100,
      currency: "BRL",
      content_ids: contentIds,
      content_type: "product",
      num_items: contentIds.length,
    },
  };
}

async function postToMeta(event) {
  const pixelId = process.env.VITE_META_PIXEL_ID;
  const testCode = String(process.env.META_TEST_EVENT_CODE || "").trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [event],
        access_token: process.env.META_CAPI_TOKEN,
        ...(testCode ? { test_event_code: testCode } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Meta respondeu ${response.status}: ${text.slice(0, 250)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

// Envia o Purchase de um pedido pago. Recarrega o pedido completo do banco (quem chama pode ter só algumas colunas).
export async function sendPurchaseForOrder(orderId) {
  if (!process.env.VITE_META_PIXEL_ID || !process.env.META_CAPI_TOKEN) return { skipped: "not_configured" };

  const rows = await sb(
    `orders?id=eq.${orderId}&select=id,status,user_id,buyer_name,buyer_email,buyer_phone,amount_cents,product_id,bump_product_ids,meta_fbp,meta_fbc,meta_client_ip,meta_user_agent,meta_event_url,meta_consent&limit=1`
  );
  const order = rows?.[0];
  if (!order || order.status !== "paid") return { skipped: "not_paid" };
  if (!order.meta_consent) return { skipped: "no_consent" };
  if (!(Number(order.amount_cents) > 0)) return { skipped: "free_order" };

  // reserva o envio: só quem conseguir preencher meta_capi_sent_at (que estava vazio) envia
  const claimed = await sb(`orders?id=eq.${order.id}&meta_capi_sent_at=is.null`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { meta_capi_sent_at: now(), meta_capi_error: null },
  });
  if (!claimed?.length) return { skipped: "already_sent" };

  try {
    await postToMeta(buildPurchaseEvent(order, { baseUrl: siteUrl() }));
    return { sent: true };
  } catch (error) {
    const reason = error.name === "AbortError" ? "A Meta demorou demais para responder." : String(error.message || error);
    console.error("meta capi error:", reason.slice(0, 300));
    // libera a reserva e guarda o motivo, para dar para ver o que houve no pedido
    await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { meta_capi_sent_at: null, meta_capi_error: reason.slice(0, 300) } }).catch(() => null);
    return { error: true };
  }
}

// Dados de rastreamento que o navegador manda ao criar o pedido. Só são guardados com consentimento explícito,
// e tudo é validado: o corpo da requisição nunca é confiável.
export function trackingColumns(meta, req) {
  if (!meta || meta.consent !== true) return {};
  const cookieValue = (value) => {
    const text = String(value || "").trim();
    return /^fb\.\d\.\d{10,13}\.[\w-]{1,200}$/.test(text) ? text : null;
  };

  let eventUrl = null;
  try {
    const url = new URL(String(meta.url || ""));
    const site = siteUrl() ? new URL(siteUrl()).hostname : "";
    const known = url.hostname === site || url.hostname === "localhost" || url.hostname.endsWith("aphhardcore.com");
    if (["http:", "https:"].includes(url.protocol) && known) eventUrl = `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    eventUrl = null;
  }

  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = (forwarded || String(req.headers["x-real-ip"] || "")).trim().slice(0, 64);
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 400);

  return {
    meta_consent: true,
    meta_fbp: cookieValue(meta.fbp),
    meta_fbc: cookieValue(meta.fbc),
    meta_client_ip: ip || null,
    meta_user_agent: userAgent || null,
    meta_event_url: eventUrl,
  };
}
