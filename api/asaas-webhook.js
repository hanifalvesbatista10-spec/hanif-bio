// POST /api/asaas-webhook
// Recebe os avisos do Asaas. É aqui que o pagamento é CONFIRMADO de verdade (nunca pelo navegador):
// marca o pedido como pago e libera o curso ao aluno. Cada aviso é processado uma única vez.
// Autenticação: o Asaas envia o token que você cadastrou no cabeçalho "asaas-access-token".
import { HttpError, readBody } from "./_lib/mux.js";
import { METHOD_BY_BILLING, checkoutHandler, requireCheckoutConfig, safeEqual, sb } from "./_lib/checkout.js";

const now = () => new Date().toISOString();

async function findOrder(payment) {
  let rows = await sb(`orders?provider_payment_id=eq.${encodeURIComponent(payment.id)}&select=*&limit=1`);
  // aviso que chega antes de gravarmos o id da cobrança no pedido: acha pela referência externa
  if (!rows?.[0] && payment.externalReference && /^[0-9a-f-]{36}$/i.test(payment.externalReference)) {
    rows = await sb(`orders?id=eq.${payment.externalReference}&select=*&limit=1`);
  }
  return rows?.[0] || null;
}

// Libera o curso: se o e-mail do comprador já tem conta, ativa o acesso agora; se não, o gatilho do banco
// (grant_paid_orders_to_new_profile) libera assim que a conta for criada com esse e-mail.
async function grantAccess(order) {
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

async function revokeAccess(order) {
  if (!order.user_id) return;
  await sb(`user_products?user_id=eq.${order.user_id}&product_id=eq.${order.product_id}`, {
    method: "PATCH",
    body: { access_status: "revoked" },
  });
}

async function handleEvent(event) {
  const payment = event.payment;
  if (!payment?.id) return;
  const order = await findOrder(payment);
  if (!order) return;

  switch (event.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      if (order.status === "paid" || order.status === "refunded") return;
      // segurança extra: o valor pago precisa cobrir o pedido
      if (Math.round(Number(payment.value) * 100) < order.amount_cents) {
        console.error("asaas webhook: valor menor que o pedido", order.id);
        return;
      }
      const method = METHOD_BY_BILLING[payment.billingType] || order.payment_method;
      await sb(`orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: { status: "paid", paid_at: now(), payment_method: method, updated_at: now() },
      });
      await grantAccess({ ...order, status: "paid" });
      return;
    }
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED": {
      if (order.status === "refunded") return;
      await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { status: "refunded", refunded_at: now(), updated_at: now() } });
      await revokeAccess(order);
      return;
    }
    case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
    case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
    case "PAYMENT_OVERDUE":
    case "PAYMENT_DELETED": {
      // um pedido já pago ou reembolsado nunca volta para "falhou" por um aviso atrasado
      if (order.status !== "pending") return;
      const status = event.event === "PAYMENT_OVERDUE" || event.event === "PAYMENT_DELETED" ? "canceled" : "failed";
      await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { status, updated_at: now() } });
      return;
    }
    default:
  }
}

export default checkoutHandler(["POST"], async (req, res) => {
  const config = requireCheckoutConfig(["webhookToken", "serviceKey"]);

  if (!safeEqual(req.headers["asaas-access-token"], config.webhookToken)) {
    throw new HttpError(401, "invalid_token", "Token inválido.");
  }

  const event = readBody(req);
  if (!event?.event) throw new HttpError(400, "invalid_event", "Aviso inválido.");
  // id do aviso (evt_...) evita processar duas vezes; sem ele, usa cobrança + tipo
  const eventId = event.id || `${event.payment?.id || "sem-id"}:${event.event}`;

  const inserted = await sb("payment_events?on_conflict=id", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: { id: eventId, type: event.event },
  });
  if (!inserted || inserted.length === 0) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    await handleEvent(event);
  } catch (error) {
    // desfaz o registro para o Asaas poder reenviar o aviso e tentarmos de novo
    await sb(`payment_events?id=eq.${encodeURIComponent(eventId)}`, { method: "DELETE" }).catch(() => null);
    throw error;
  }

  res.status(200).json({ received: true });
});
