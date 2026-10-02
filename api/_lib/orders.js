// Regras de pedido compartilhadas pelos avisos de pagamento (InfinitePay e Asaas).
import { sb } from "./checkout.js";
import { notifyOwnerOfSale } from "./notify.js";

const now = () => new Date().toISOString();

// Libera o curso: se o e-mail do comprador já tem conta, ativa o acesso agora; se não, o gatilho do banco
// (grant_paid_orders_to_new_profile) libera assim que a conta for criada com esse e-mail.
export async function grantAccess(order) {
  let userId = order.user_id;
  if (!userId) {
    // ilike sem diferenciar maiúsculas; "\", "%" e "_" são escapados para casar o e-mail exato (e "*" é curinga do PostgREST)
    const email = String(order.buyer_email || "");
    const exact = email.replace(/[\\%_]/g, "\\$&");
    const profiles = email.includes("*") ? [] : await sb(`profiles?email=ilike.${encodeURIComponent(exact)}&select=id&limit=2`);
    userId = profiles?.length === 1 ? profiles[0].id : null;
    if (userId) await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { user_id: userId, updated_at: now() } });
  }
  if (!userId) return false;
  // produto principal + cada produto extra (order bump) comprado junto neste pedido
  const productIds = [order.product_id, ...(order.bump_product_ids || [])];
  await sb("user_products?on_conflict=user_id,product_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: productIds.map((productId) => ({ user_id: userId, product_id: productId, access_status: "active" })),
  });
  return true;
}

export async function revokeAccess(order) {
  if (!order.user_id) return;
  const productIds = [order.product_id, ...(order.bump_product_ids || [])];
  const list = productIds.join(","); // ids são uuid puro (sem vírgula/espaço), não precisa de aspas no filtro
  await sb(`user_products?user_id=eq.${order.user_id}&product_id=in.(${list})`, {
    method: "PATCH",
    body: { access_status: "revoked" },
  });
}

// Comissão progressiva (SQL 36): sem comissão própria definida no afiliado, a taxa sobe conforme as vendas
// pagas DESTE MÊS (mês corrente, reinicia todo dia 1). Vale só da venda que bate a meta em diante — as
// comissões já registradas antes não mudam. "Vendas do mês" conta owed+paid, nunca void (estornado não conta).
async function resolveCommissionPercent(affiliateId, ownPercent) {
  if (Number.isFinite(ownPercent) && ownPercent > 0) return ownPercent;

  const settings = await sb(`affiliate_settings?id=eq.1&select=default_commission_percent,tier2_threshold,tier2_percent,tier3_threshold,tier3_percent&limit=1`);
  const s = settings?.[0];
  const base = Number(s?.default_commission_percent);
  if (!Number.isFinite(base) || base <= 0) return null;

  const now0 = new Date();
  const monthStart = new Date(Date.UTC(now0.getUTCFullYear(), now0.getUTCMonth(), 1)).toISOString();
  const priorSales = await sb(
    `affiliate_commissions?affiliate_id=eq.${affiliateId}&status=neq.void&created_at=gte.${monthStart}&select=id`
  );
  const ordinal = (priorSales?.length || 0) + 1; // esta venda é a Nª paga do afiliado neste mês

  const tier3 = Number(s.tier3_threshold);
  const tier2 = Number(s.tier2_threshold);
  if (Number.isFinite(tier3) && ordinal >= tier3) return Number(s.tier3_percent) || base;
  if (Number.isFinite(tier2) && ordinal >= tier2) return Number(s.tier2_percent) || base;
  return base;
}

// Comissão de afiliado (SQL 34/36): se o pedido usou um cupom ligado a um afiliado ativo, calcula e guarda
// a comissão num registro à parte (uma vez por pedido). Nunca derruba o pagamento: um erro aqui só fica no
// log, o aluno recebe o acesso de qualquer jeito.
async function recordAffiliateCommission(order) {
  if (!order.coupon_id) return;
  const coupons = await sb(`coupons?id=eq.${order.coupon_id}&select=affiliate_id&limit=1`);
  const affiliateId = coupons?.[0]?.affiliate_id;
  if (!affiliateId) return;

  const affiliates = await sb(`affiliates?id=eq.${affiliateId}&select=id,status,email,commission_percent&limit=1`);
  const affiliate = affiliates?.[0];
  if (!affiliate || affiliate.status !== "active") return;
  // o próprio afiliado não ganha comissão comprando com o link dele
  if (affiliate.email && order.buyer_email && String(affiliate.email).toLowerCase() === String(order.buyer_email).toLowerCase()) return;

  const percent = await resolveCommissionPercent(affiliateId, Number(affiliate.commission_percent));
  if (!Number.isFinite(percent) || percent <= 0) return;

  const amountCents = Math.round((Number(order.amount_cents) * percent) / 100);
  if (amountCents <= 0) return;

  await sb("affiliate_commissions?on_conflict=order_id", {
    method: "POST",
    prefer: "resolution=ignore-duplicates",
    body: { affiliate_id: affiliateId, order_id: order.id, base_cents: order.amount_cents, percent_used: percent, amount_cents: amountCents, status: "owed" },
  });
}

// Estorno/chargeback: a comissão ainda não paga é anulada (não some do histórico, só deixa de ser devida).
export async function voidAffiliateCommission(order) {
  await sb(`affiliate_commissions?order_id=eq.${order.id}&status=eq.owed`, { method: "PATCH", body: { status: "void" } }).catch((error) => {
    console.error("voidAffiliateCommission:", error.message);
  });
}

// Marca o pedido como pago (uma vez só) e libera o acesso. Devolve false se já estava pago/reembolsado.
export async function markOrderPaid(order, method) {
  if (order.status === "paid" || order.status === "refunded") return false;
  await sb(`orders?id=eq.${order.id}`, {
    method: "PATCH",
    body: { status: "paid", paid_at: now(), payment_method: method || order.payment_method || null, updated_at: now() },
  });
  await grantAccess({ ...order, status: "paid" });
  await recordAffiliateCommission(order).catch((error) => console.error("recordAffiliateCommission:", error.message));
  await notifyOwnerOfSale(order).catch((error) => console.error("notifyOwnerOfSale:", error.message));
  return true;
}
