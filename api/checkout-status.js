// GET /api/checkout-status?order=<id do pedido>[&transaction_nsu=...&slug=...]
// Devolve só o essencial (status e nome do produto) para a página de "obrigado" acompanhar o pagamento.
// O id do pedido é um UUID impossível de adivinhar.
// Se o comprador volta da InfinitePay com transaction_nsu e slug, o pagamento é conferido na hora na
// InfinitePay (não depende só do aviso), o que também cobre um aviso atrasado.
import { HttpError } from "./_lib/mux.js";
import { checkoutConfig, checkoutHandler, requireCheckoutConfig, sb } from "./_lib/checkout.js";
import { confirmOrder } from "./_lib/infinitepay.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "id,status,provider,payment_method,amount_cents,user_id,buyer_email,product_id,product:products(title,slug)";

async function loadOrder(id) {
  const rows = await sb(`orders?id=eq.${id}&select=${COLUMNS}&limit=1`);
  return rows?.[0] || null;
}

export default checkoutHandler(["GET"], async (req, res) => {
  requireCheckoutConfig(["serviceKey"]);
  const id = String(req.query?.order || "").trim();
  if (!UUID.test(id)) throw new HttpError(400, "invalid_order", "Pedido inválido.");

  let order = await loadOrder(id);
  if (!order) throw new HttpError(404, "order_not_found", "Pedido não encontrado.");

  const transactionNsu = String(req.query?.transaction_nsu || "").trim();
  const slug = String(req.query?.slug || "").trim();
  if (order.status === "pending" && order.provider === "infinitepay" && transactionNsu && slug && checkoutConfig().infinitepayHandle) {
    try {
      const result = await confirmOrder(order, { transactionNsu, slug });
      if (result.paid) order = await loadOrder(id);
    } catch (error) {
      // se a conferência falhar agora, o aviso de pagamento ainda confirma depois
      console.error("infinitepay confirm (status) error:", error.status || "", error.message);
    }
  }

  res.status(200).setHeader("Cache-Control", "no-store").json({
    status: order.status,
    paymentMethod: order.payment_method,
    amount: order.amount_cents,
    productTitle: order.product?.title || "",
    productSlug: order.product?.slug || "",
    hasAccount: Boolean(order.user_id),
    // e-mail mascarado só para o comprador reconhecer com qual e-mail deve entrar
    emailHint: String(order.buyer_email || "").replace(/^(.{2}).*(@.*)$/, "$1***$2"),
  });
});
