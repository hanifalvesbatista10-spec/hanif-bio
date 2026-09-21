// GET /api/checkout-status?order=<id do pedido>
// Devolve só o essencial (status e nome do produto) para a página de "obrigado" acompanhar o pagamento.
// O id do pedido é um UUID impossível de adivinhar.
import { HttpError } from "./_lib/mux.js";
import { checkoutHandler, requireCheckoutConfig, sb } from "./_lib/checkout.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default checkoutHandler(["GET"], async (req, res) => {
  requireCheckoutConfig(["serviceKey"]);
  const id = String(req.query?.order || "").trim();
  if (!UUID.test(id)) throw new HttpError(400, "invalid_order", "Pedido inválido.");

  const rows = await sb(
    `orders?id=eq.${id}&select=id,status,payment_method,amount_cents,user_id,buyer_email,product:products(title,slug)&limit=1`
  );
  const order = rows?.[0];
  if (!order) throw new HttpError(404, "order_not_found", "Pedido não encontrado.");

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
