// POST /api/infinitepay-webhook
// Aviso de pagamento da InfinitePay (Pix ou cartão). O aviso deles não tem assinatura, então NADA do que
// vem no corpo é confiável: cada pagamento é conferido de volta na InfinitePay (payment_check) antes de
// marcar o pedido como pago e liberar o curso. Um aviso falso simplesmente não confirma nada.
// Resposta: 200 = ok; 400 = não deu para confirmar (a InfinitePay tenta de novo).
import { HttpError, readBody } from "./_lib/mux.js";
import { checkoutHandler, requireCheckoutConfig, sb } from "./_lib/checkout.js";
import { confirmOrder } from "./_lib/infinitepay.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default checkoutHandler(["POST"], async (req, res) => {
  requireCheckoutConfig(["infinitepayHandle", "serviceKey"]);
  const body = readBody(req);

  const orderId = String(body.order_nsu || "").trim();
  const transactionNsu = String(body.transaction_nsu || "").trim();
  const slug = String(body.invoice_slug || body.slug || "").trim();
  if (!UUID.test(orderId) || !transactionNsu || !slug) throw new HttpError(400, "invalid_event", "Aviso inválido.");

  const rows = await sb(`orders?id=eq.${orderId}&provider=eq.infinitepay&select=*&limit=1`);
  const order = rows?.[0];
  if (!order) {
    // venda que não é do checkout do site (ou pedido desconhecido): nada a fazer, sem novas tentativas
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  // Idempotência: o mesmo pagamento não é processado duas vezes.
  const eventId = `ip:${transactionNsu}`;
  const inserted = await sb("payment_events?on_conflict=id", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: { id: eventId, type: "infinitepay.payment" },
  });
  if (!inserted || inserted.length === 0) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    const result = await confirmOrder(order, { transactionNsu, slug });
    if (!result.paid) throw new HttpError(400, "not_confirmed", "Pagamento ainda não confirmado na InfinitePay.");
  } catch (error) {
    // libera o registro para uma nova tentativa (a InfinitePay reenvia quando respondemos erro)
    await sb(`payment_events?id=eq.${encodeURIComponent(eventId)}`, { method: "DELETE" }).catch(() => null);
    if (error instanceof HttpError) throw error;
    console.error("infinitepay webhook error:", error.status || "", error.message);
    throw new HttpError(400, "verification_failed", "Não foi possível confirmar o pagamento agora.");
  }

  res.status(200).json({ received: true });
});
