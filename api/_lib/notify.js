// Aviso instantâneo ao dono quando uma venda é paga: Telegram (bot) e e-mail (Resend).
// Cada canal só roda se estiver configurado na Vercel e nunca derruba o pagamento: erro vira log.
import { sb } from "./checkout.js";
import { sendEmail, resendConfig } from "./resend.js";

const METHOD = { pix: "Pix", boleto: "Boleto", card: "Cartão" };
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

async function describeOrder(order) {
  const ids = [order.product_id, ...(order.bump_product_ids || [])];
  const products = await sb(`products?id=in.(${ids.join(",")})&select=id,title`).catch(() => []);
  const titleOf = (id) => products?.find((p) => p.id === id)?.title || "Produto";
  let coupon = "";
  if (order.coupon_id) {
    const rows = await sb(`coupons?id=eq.${order.coupon_id}&select=code&limit=1`).catch(() => []);
    coupon = rows?.[0]?.code || "";
  }
  return {
    main: titleOf(order.product_id),
    bumps: (order.bump_product_ids || []).map(titleOf),
    coupon,
    method: METHOD[order.payment_method] || "",
    amount: money(order.amount_cents),
    buyer: `${order.buyer_name || "Sem nome"} (${order.buyer_email || "sem e-mail"})`,
  };
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Telegram ${response.status}${data?.description ? ` - ${data.description}` : ""}`);
  }
}

export async function notifyOwnerOfSale(order) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  const { apiKey, from } = resendConfig();
  const telegramOn = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID;
  const emailOn = to && apiKey && from;
  if (!telegramOn && !emailOn) return;

  const d = await describeOrder(order);
  const lines = [
    `Valor: ${d.amount}${d.method ? ` no ${d.method}` : ""}`,
    `Produto: ${d.main}`,
    ...(d.bumps.length ? [`Extras: ${d.bumps.join(", ")}`] : []),
    `Comprador: ${d.buyer}`,
    ...(d.coupon ? [`Cupom: ${d.coupon}`] : []),
  ];

  // Se o Telegram não sair, o e-mail avisa o motivo (as chaves ficam ocultas na Vercel e os logs são difíceis de achar).
  let telegramProblem = "";
  if (!telegramOn) {
    const missing = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].filter((name) => !process.env[name]);
    telegramProblem = `Telegram não configurado: falta ${missing.join(" e ")} na Vercel (ou falta um redeploy).`;
  } else {
    await sendTelegram(`Nova venda!\n${lines.join("\n")}`).catch((error) => {
      console.error("notifyOwnerOfSale telegram:", error.message);
      telegramProblem = `O aviso no Telegram falhou: ${error.message}`;
    });
  }

  if (emailOn) {
    const body = [...lines, ...(telegramProblem ? ["", telegramProblem] : [])];
    await sendEmail({
      to,
      subject: `Nova venda: ${d.main} (${d.amount})`,
      html: `<h2>Nova venda</h2><p>${body.map(escapeHtml).join("<br>")}</p>`,
    }).catch((error) => console.error("notifyOwnerOfSale email:", error.message));
  }
}
