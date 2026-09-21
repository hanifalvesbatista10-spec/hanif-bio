// POST /api/asaas-webhook
// Recebe os avisos do Asaas (usado para o BOLETO). É aqui que o pagamento é CONFIRMADO de verdade
// (nunca pelo navegador): marca o pedido como pago e libera o curso ao aluno. Cada aviso é processado
// uma única vez. Autenticação: o Asaas envia o token que você cadastrou no cabeçalho "asaas-access-token".
import { HttpError, readBody } from "./_lib/mux.js";
import { METHOD_BY_BILLING, checkoutHandler, requireCheckoutConfig, safeEqual, sb } from "./_lib/checkout.js";
import { markOrderPaid, revokeAccess } from "./_lib/orders.js";

const now = () => new Date().toISOString();

async function findOrder(payment) {
  let rows = await sb(`orders?provider_payment_id=eq.${encodeURIComponent(payment.id)}&select=*&limit=1`);
  // aviso que chega antes de gravarmos o id da cobrança no pedido: acha pela referência externa
  if (!rows?.[0] && payment.externalReference && /^[0-9a-f-]{36}$/i.test(payment.externalReference)) {
    rows = await sb(`orders?id=eq.${payment.externalReference}&select=*&limit=1`);
  }
  return rows?.[0] || null;
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
      await markOrderPaid(order, METHOD_BY_BILLING[payment.billingType] || order.payment_method);
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
