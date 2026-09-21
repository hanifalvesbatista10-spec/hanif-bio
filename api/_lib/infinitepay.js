// Checkout Integrado da InfinitePay (Pix e cartão). Não há chave secreta: a conta é identificada pela
// InfiniteTag. Como o aviso de pagamento deles NÃO tem assinatura, todo pagamento é conferido de volta na
// InfinitePay (payment_check) antes de liberar o curso.
import { checkoutConfig } from "./checkout.js";
import { markOrderPaid } from "./orders.js";

const API = "https://api.checkout.infinitepay.io";

const METHOD_BY_CAPTURE = { credit_card: "card", pix: "pix" };

async function post(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `InfinitePay ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Cria o link de pagamento (a página deles oferece Pix e cartão, com escolha de parcelas).
export async function createCheckoutLink({ order, title, name, email, redirectUrl, webhookUrl }) {
  const { infinitepayHandle } = checkoutConfig();
  const data = await post("/links", {
    handle: infinitepayHandle,
    order_nsu: order.id,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    items: [{ quantity: 1, price: order.amount_cents, description: String(title).slice(0, 200) }],
    customer: { name, email },
  });
  const url = data?.url || data?.link || data?.checkout_url;
  if (!url || !/^https:\/\//.test(url)) throw new Error("A InfinitePay não devolveu o link de pagamento.");
  return url;
}

// Pergunta à InfinitePay se o pagamento realmente aconteceu. O valor "amount" é o preço do produto;
// "paid_amount" inclui o juro do parcelamento pago pelo comprador.
export async function verifyPayment(order, { transactionNsu, slug }) {
  const { infinitepayHandle } = checkoutConfig();
  const data = await post("/payment_check", {
    handle: infinitepayHandle,
    order_nsu: order.id,
    transaction_nsu: transactionNsu,
    slug,
  });
  if (!data?.paid) return { paid: false, reason: "not_paid" };
  const amount = Number(data.amount ?? data.paid_amount);
  if (!Number.isFinite(amount) || amount < order.amount_cents) return { paid: false, reason: "amount_mismatch" };
  return {
    paid: true,
    method: METHOD_BY_CAPTURE[data.capture_method] || null,
    paidAmount: Number(data.paid_amount) || amount,
    installments: Number(data.installments) || 1,
  };
}

// Confere e, se pago, marca o pedido e libera o acesso. Idempotente.
export async function confirmOrder(order, ids) {
  const result = await verifyPayment(order, ids);
  if (result.paid) await markOrderPaid(order, result.method);
  return result;
}
