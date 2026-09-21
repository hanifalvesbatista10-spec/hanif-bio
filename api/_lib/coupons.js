// Regras de cupom de desconto. Tudo é decidido aqui, no servidor: o navegador só manda o código.
import { HttpError } from "./mux.js";
import { sb } from "./checkout.js";

// Um valor cobrado no gateway abaixo disso é recusado por eles; zero é permitido (acesso grátis).
export const MIN_CHARGE_CENTS = 500;
// Pedido "aguardando" segura o cupom por este tempo (evita esgotar o cupom com pedidos abandonados)
const PENDING_HOLD_MS = 60 * 60 * 1000;

export const normalizeCode = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

export function computeDiscount(coupon, listCents) {
  const raw = coupon.discount_type === "percent" ? Math.floor((listCents * coupon.discount_value) / 100) : coupon.discount_value;
  const discount = Math.min(Math.max(raw, 0), listCents);
  return { discountCents: discount, finalCents: listCents - discount };
}

const holds = (order, now) =>
  order.status === "paid" || (order.status === "pending" && now - new Date(order.created_at).getTime() < PENDING_HOLD_MS);

// Valida o cupom para este produto e comprador. Devolve { coupon, discountCents, finalCents } ou lança HttpError.
export async function resolveCoupon({ code, product, listCents, email, cpf, now = Date.now() }) {
  const normalized = normalizeCode(code);
  const invalid = () => new HttpError(422, "invalid_coupon", "Cupom inválido ou expirado.");
  if (!/^[A-Z0-9_-]{2,40}$/.test(normalized)) throw invalid();

  let rows;
  try {
    // o código só tem letras, números, "-" e "_"; o "_" é curinga do ilike, então é escapado
    rows = await sb(`coupons?code=ilike.${encodeURIComponent(normalized.replace(/_/g, "\\_"))}&select=*&limit=2`);
  } catch (error) {
    // tabela de cupons ainda não criada (SQL 20) ou banco fora do ar
    throw new HttpError(503, "coupons_unavailable", "Cupons indisponíveis no momento.");
  }
  const coupon = rows?.find((row) => normalizeCode(row.code) === normalized);
  if (!coupon || !coupon.active) throw invalid();
  if (coupon.product_id && coupon.product_id !== product.id) throw invalid();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) throw invalid();
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) throw invalid();

  if (coupon.max_uses || coupon.one_per_customer) {
    const used = (await sb(`orders?coupon_id=eq.${coupon.id}&select=id,status,created_at,buyer_email,buyer_cpf&limit=5000`)) || [];
    const active = used.filter((order) => (order.status === "paid" || order.status === "pending") && holds(order, now));
    if (coupon.max_uses && active.length >= coupon.max_uses) throw new HttpError(422, "coupon_exhausted", "Este cupom esgotou.");
    if (coupon.one_per_customer) {
      const same = active.some((order) => (email && String(order.buyer_email).toLowerCase() === email) || (cpf && order.buyer_cpf === cpf));
      if (same) throw new HttpError(422, "coupon_already_used", "Você já usou este cupom.");
    }
  }

  const { discountCents, finalCents } = computeDiscount(coupon, listCents);
  if (finalCents > 0 && finalCents < MIN_CHARGE_CENTS) {
    throw new HttpError(422, "coupon_below_minimum", "Com este cupom o valor fica abaixo do mínimo de R$ 5,00. Fale com a gente.");
  }
  return { coupon, discountCents, finalCents };
}
