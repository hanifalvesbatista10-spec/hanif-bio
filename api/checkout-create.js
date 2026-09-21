// POST /api/checkout-create
// Cria o pedido e a cobrança no Asaas (Pix, boleto ou cartão) e devolve o que o navegador precisa mostrar:
// QR code do Pix, linha digitável do boleto ou o link seguro do Asaas para pagar com cartão.
// O VALOR sai do banco, nunca do navegador.
import { HttpError, readBody } from "./_lib/mux.js";
import {
  METHODS,
  asaas,
  brDate,
  checkoutHandler,
  isValidCpf,
  isValidEmail,
  optionalUserId,
  priceInCents,
  requireCheckoutConfig,
  sb,
} from "./_lib/checkout.js";

const now = () => new Date().toISOString();

// Reaproveita o cliente do Asaas pelo CPF; se não existe, cria.
async function ensureCustomer({ name, email, cpf, phone }) {
  const found = await asaas(`/customers?cpfCnpj=${cpf}&limit=1`);
  if (found?.data?.[0]?.id) return found.data[0].id;
  const created = await asaas("/customers", {
    method: "POST",
    body: { name, email, cpfCnpj: cpf, ...(phone ? { mobilePhone: phone.replace(/\D/g, "") } : {}) },
  });
  return created.id;
}

// A cobrança de cartão redireciona de volta ao site depois de paga (o domínio precisa estar
// cadastrado na conta do Asaas; se o Asaas recusar o retorno, criamos a cobrança sem ele).
function returnUrl(req, orderId) {
  const origin = process.env.SITE_URL || req.headers.origin || "";
  return /^https?:\/\//.test(origin) ? `${origin.replace(/\/$/, "")}/checkout/obrigado?order=${orderId}` : "";
}

export default checkoutHandler(["POST"], async (req, res) => {
  requireCheckoutConfig(["asaasKey", "serviceKey"]);
  const body = readBody(req);

  const slug = String(body.slug || "").trim();
  const method = String(body.method || "").trim();
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const email = String(body.email || "").trim().toLowerCase();
  const cpf = String(body.cpf || "").replace(/\D/g, "");
  const phone = String(body.phone || "").replace(/[^\d+]/g, "").slice(0, 20);

  if (!slug) throw new HttpError(400, "invalid_product", "Produto não informado.");
  if (!METHODS[method]) throw new HttpError(400, "invalid_method", "Escolha a forma de pagamento.");
  if (name.length < 3) throw new HttpError(400, "invalid_name", "Informe seu nome completo.");
  if (!isValidEmail(email)) throw new HttpError(400, "invalid_email", "Informe um e-mail válido.");
  if (!isValidCpf(cpf)) throw new HttpError(400, "invalid_cpf", "O CPF informado não é válido.");

  const products = await sb(
    `products?slug=eq.${encodeURIComponent(slug)}&select=id,title,slug,price,promotional_price,status,checkout_mode&limit=1`
  );
  const product = products?.[0];
  if (!product || product.status !== "active") throw new HttpError(404, "product_not_found", "Produto não encontrado.");
  if (product.checkout_mode !== "internal") {
    throw new HttpError(409, "checkout_disabled", "Este produto não usa o checkout do site.");
  }
  const amount = priceInCents(product);
  if (amount < 500) throw new HttpError(409, "invalid_price", "O preço deste produto não está configurado.");

  const userId = await optionalUserId(req);

  const created = await sb("orders", {
    method: "POST",
    prefer: "return=representation",
    body: {
      product_id: product.id,
      user_id: userId,
      buyer_name: name,
      buyer_email: email,
      buyer_cpf: cpf,
      buyer_phone: phone || null,
      amount_cents: amount,
      currency: "brl",
      status: "pending",
      payment_method: method,
      provider: "asaas",
    },
  });
  const order = created?.[0];
  if (!order) throw new HttpError(500, "order_failed", "Não foi possível registrar o pedido.");

  let payment;
  let result;
  try {
    const customer = await ensureCustomer({ name, email, cpf, phone });
    const charge = {
      customer,
      billingType: METHODS[method],
      value: amount / 100,
      dueDate: brDate(method === "boleto" ? 3 : 0),
      description: product.title.slice(0, 500),
      externalReference: order.id,
    };
    const back = method === "card" ? returnUrl(req, order.id) : "";
    try {
      payment = await asaas("/payments", { method: "POST", body: back ? { ...charge, callback: { successUrl: back, autoRedirect: true } } : charge });
    } catch (error) {
      // domínio do retorno não cadastrado no Asaas: cria sem o retorno automático
      if (!back || !/callback|successUrl|dom[ií]nio|domain/i.test(error.message)) throw error;
      payment = await asaas("/payments", { method: "POST", body: charge });
    }

    if (method === "pix") {
      const qr = await asaas(`/payments/${payment.id}/pixQrCode`);
      result = { pix: { qrImage: qr.encodedImage, payload: qr.payload, expiresAt: qr.expirationDate } };
    } else if (method === "boleto") {
      const line = await asaas(`/payments/${payment.id}/identificationField`);
      result = { boleto: { line: line.identificationField, url: payment.bankSlipUrl || payment.invoiceUrl, dueDate: payment.dueDate } };
    } else {
      if (!payment.invoiceUrl) throw new Error("O Asaas não devolveu o link de pagamento.");
      result = { card: { url: payment.invoiceUrl } };
    }
  } catch (error) {
    await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { status: "failed", updated_at: now() } }).catch(() => null);
    console.error("asaas error:", error.status || "", error.message);
    throw new HttpError(502, "gateway_error", "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.");
  }

  const paymentUrl = result.boleto?.url || result.card?.url || null;
  await sb(`orders?id=eq.${order.id}`, {
    method: "PATCH",
    body: { provider_payment_id: payment.id, payment_url: paymentUrl, updated_at: now() },
  });

  res.status(201).setHeader("Cache-Control", "no-store").json({
    orderId: order.id,
    method,
    amount,
    productTitle: product.title,
    ...result,
  });
});
