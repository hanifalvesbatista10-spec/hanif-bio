// Avisos instantâneos ao dono. Venda paga: Telegram + e-mail (Resend). Demais eventos: só Telegram.
// Cada canal só roda se estiver configurado na Vercel e nunca derruba o pagamento: erro vira log.
import { sb } from "./checkout.js";
import { sendEmail, resendConfig } from "./resend.js";

const METHOD = { pix: "Pix", boleto: "Boleto", card: "Cartão" };
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

const EVENT_TITLE = {
  pending: "Pedido aguardando pagamento",
  gateway_error: "Erro ao iniciar o pagamento",
  failed: "Pagamento recusado",
  canceled: "Boleto vencido ou cancelado",
  refunded: "Reembolso ou estorno",
};

async function describeOrder(order) {
  const ids = [order.product_id, ...(order.bump_product_ids || [])];
  const products = await sb(`products?id=in.(${ids.join(",")})&select=id,title`).catch(() => []);
  const titleOf = (id) => products?.find((p) => p.id === id)?.title || "Produto";
  let coupon = "";
  if (order.coupon_id) {
    const rows = await sb(`coupons?id=eq.${order.coupon_id}&select=code&limit=1`).catch(() => []);
    coupon = rows?.[0]?.code || "";
  }
  const bumps = (order.bump_product_ids || []).map(titleOf);
  const method = METHOD[order.payment_method] || (order.provider === "infinitepay" ? "Pix ou cartão" : "");
  return {
    main: titleOf(order.product_id),
    amount: money(order.amount_cents),
    lines: [
      `Valor: ${money(order.amount_cents)}${method ? ` (${method})` : ""}`,
      `Produto: ${titleOf(order.product_id)}`,
      ...(bumps.length ? [`Extras: ${bumps.join(", ")}`] : []),
      `Comprador: ${order.buyer_name || "Sem nome"} (${order.buyer_email || "sem e-mail"})`,
      ...(order.buyer_phone ? [`WhatsApp: ${order.buyer_phone}`] : []),
      ...(coupon ? [`Cupom: ${coupon}`] : []),
    ],
  };
}

export async function sendTelegram(text) {
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

// Evento de pedido que não é venda paga (aguardando, erro, recusado, cancelado, reembolso): só Telegram.
export async function notifyOrderEvent(order, kind, detail = "") {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
    const d = await describeOrder(order);
    await sendTelegram([EVENT_TITLE[kind] || "Pedido", ...d.lines, ...(detail ? [detail] : [])].join("\n"));
  } catch (error) {
    console.error(`notifyOrderEvent ${kind}:`, error.message);
  }
}

export async function notifyOwnerOfSale(order) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  const { apiKey, from } = resendConfig();
  const telegramOn = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID;
  const emailOn = to && apiKey && from;
  if (!telegramOn && !emailOn) return;

  const d = await describeOrder(order);

  // Se o Telegram não sair, o e-mail avisa o motivo (as chaves ficam ocultas na Vercel e os logs são difíceis de achar).
  let telegramProblem = "";
  if (!telegramOn) {
    const missing = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].filter((name) => !process.env[name]);
    telegramProblem = `Telegram não configurado: falta ${missing.join(" e ")} na Vercel (ou falta um redeploy).`;
  } else {
    await sendTelegram(["Nova venda!", ...d.lines].join("\n")).catch((error) => {
      console.error("notifyOwnerOfSale telegram:", error.message);
      telegramProblem = `O aviso no Telegram falhou: ${error.message}`;
    });
  }

  if (emailOn) {
    const body = [...d.lines, ...(telegramProblem ? ["", telegramProblem] : [])];
    await sendEmail({
      to,
      subject: `Nova venda: ${d.main} (${d.amount})`,
      html: `<h2>Nova venda</h2><p>${body.map(escapeHtml).join("<br>")}</p>`,
    }).catch((error) => console.error("notifyOwnerOfSale email:", error.message));
  }
}
