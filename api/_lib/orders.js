// Regras de pedido compartilhadas pelos avisos de pagamento (InfinitePay e Asaas).
import { sb } from "./checkout.js";

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
  await sb("user_products?on_conflict=user_id,product_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: { user_id: userId, product_id: order.product_id, access_status: "active" },
  });
  return true;
}

export async function revokeAccess(order) {
  if (!order.user_id) return;
  await sb(`user_products?user_id=eq.${order.user_id}&product_id=eq.${order.product_id}`, {
    method: "PATCH",
    body: { access_status: "revoked" },
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
  return true;
}
