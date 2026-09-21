// POST /api/checkout-create
// Cria o pedido e a cobrança e devolve o que o navegador precisa para o comprador pagar:
//  - method "online": link da InfinitePay, onde o comprador escolhe Pix ou cartão (e as parcelas);
//  - method "boleto": boleto do Asaas (linha digitável e PDF).
// O VALOR sai do banco, nunca do navegador.
import { HttpError, readBody } from "./_lib/mux.js";
import {
  PROVIDER_BY_METHOD,
  asaas,
  brDate,
  checkoutHandler,
  isValidCpf,
  isValidEmail,
  normalizeMethod,
  optionalUserId,
  priceInCents,
  requireCheckoutConfig,
  sb,
  siteUrl,
} from "./_lib/checkout.js";
import { createCheckoutLink } from "./_lib/infinitepay.js";

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

export default checkoutHandler(["POST"], async (req, res) => {
  const body = readBody(req);
  const method = normalizeMethod(body.method);
  if (!method) throw new HttpError(400, "invalid_method", "Escolha a forma de pagamento.");
  // cada forma de pagamento exige as variáveis do seu provedor
  requireCheckoutConfig(method === "online" ? ["infinitepayHandle", "serviceKey"] : ["asaasKey", "serviceKey"]);

  const slug = String(body.slug || "").trim();
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const email = String(body.email || "").trim().toLowerCase();
  const cpf = String(body.cpf || "").replace(/\D/g, "");
  const phone = String(body.phone || "").replace(/[^\d+]/g, "").slice(0, 20);

  if (!slug) throw new HttpError(400, "invalid_product", "Produto não informado.");
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

  const base = siteUrl(req);
  if (method === "online" && !base) {
    throw new HttpError(503, "checkout_not_configured", "Checkout ainda não configurado no servidor (faltam: SITE_URL).");
  }

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
      // "online" (Pix ou cartão) só se sabe qual foi depois de pago; o aviso de pagamento preenche
      payment_method: method === "boleto" ? "boleto" : null,
      provider: PROVIDER_BY_METHOD[method],
    },
  });
  const order = created?.[0];
  if (!order) throw new HttpError(500, "order_failed", "Não foi possível registrar o pedido.");

  let result;
  let providerPaymentId = null;
  let paymentUrl = null;
  try {
    if (method === "online") {
      paymentUrl = await createCheckoutLink({
        order,
        title: product.title,
        name,
        email,
        redirectUrl: `${base}/checkout/obrigado?order=${order.id}`,
        webhookUrl: `${base}/api/infinitepay-webhook`,
      });
      result = { online: { url: paymentUrl } };
    } else {
      const customer = await ensureCustomer({ name, email, cpf, phone });
      const payment = await asaas("/payments", {
        method: "POST",
        body: {
          customer,
          billingType: "BOLETO",
          value: amount / 100,
          dueDate: brDate(3),
          description: product.title.slice(0, 500),
          externalReference: order.id,
        },
      });
      const line = await asaas(`/payments/${payment.id}/identificationField`);
      providerPaymentId = payment.id;
      paymentUrl = payment.bankSlipUrl || payment.invoiceUrl || null;
      result = { boleto: { line: line.identificationField, url: paymentUrl, dueDate: payment.dueDate } };
    }
  } catch (error) {
    await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { status: "failed", updated_at: now() } }).catch(() => null);
    // o motivo real vai para o log da Vercel e para o teste de conexão do painel (Pedidos → Testar conexão)
    console.error(`${PROVIDER_BY_METHOD[method]} error:`, error.status || "", error.message);
    throw new HttpError(502, "gateway_error", "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.");
  }

  await sb(`orders?id=eq.${order.id}`, {
    method: "PATCH",
    body: { provider_payment_id: providerPaymentId, payment_url: paymentUrl, updated_at: now() },
  });

  res.status(201).setHeader("Cache-Control", "no-store").json({
    orderId: order.id,
    method,
    amount,
    productTitle: product.title,
    ...result,
  });
});
