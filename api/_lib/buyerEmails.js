// E-mails ao COMPRADOR: confirmação de compra (logo depois do pagamento) e lembrete para quem pagou e ainda não criou conta.
// Regras:
//  - confirmação: UM envio por pedido (buyer_email_sent_at é "reservado" antes de enviar, então aviso repetido do gateway não duplica);
//  - lembrete: só para pedido pago SEM conta (user_id nulo), 2 dias e 6 dias depois do pagamento, uma vez cada;
//  - falha de envio nunca derruba o pagamento: vira log, fica gravada no pedido e avisa o dono no Telegram;
//  - a conta continua precisando ter o MESMO e-mail da compra (é assim que o acesso é ligado).
import { sb, siteUrl } from "./checkout.js";
import { sendEmail } from "./resend.js";
import { sendTelegram } from "./notify.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const shortId = (id) => String(id || "").slice(0, 8).toUpperCase();
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
const safeUrl = (value) => (/^https?:\/\//i.test(String(value || "")) ? String(value) : "");

const button = (url, label) =>
  `<p style="margin:26px 0 8px"><a href="${escapeHtml(url)}" style="background:#d6152d;color:#ffffff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">${escapeHtml(label)}</a></p>`;

function layout(inner) {
  return `<div style="background:#f4f7fa;padding:24px 12px">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;color:#13283c;line-height:1.6">
    <div style="background:#071426;color:#ffffff;padding:18px 26px">
      <div style="font-size:18px;font-weight:800;letter-spacing:0.02em">HANIF ALVES</div>
      <div style="font-size:11px;letter-spacing:0.12em;color:#a9bacb">APH &bull; URGÊNCIA &bull; EMERGÊNCIA</div>
    </div>
    <div style="padding:26px">${inner}</div>
  </div>
</div>`;
}

// Parágrafo de ajuda no rodapé dos e-mails (WhatsApp do site, se estiver cadastrado).
const helpLine = (whatsappUrl) => {
  const url = safeUrl(whatsappUrl);
  return url
    ? `<p style="color:#55687a;font-size:14px">Dúvidas ou algo não funcionou? Fale com a gente pelo <a href="${escapeHtml(url)}" style="color:#d6152d">WhatsApp</a>.</p>`
    : `<p style="color:#55687a;font-size:14px">Dúvidas ou algo não funcionou? É só responder a este e-mail.</p>`;
};

// E-mail de "compra confirmada". hasAccount = já existe conta com o e-mail da compra (o acesso já está ligado).
export function purchaseConfirmationEmail({ name, email, titles, amountCents, hasAccount, hold, base, whatsappUrl, orderId }) {
  const hi = firstName(name);
  const list = titles.map((title) => `<li style="margin:2px 0">${escapeHtml(title)}</li>`).join("");
  const free = !(Number(amountCents) > 0);

  const access = hasAccount
    ? `<p>O seu acesso <strong>já está liberado</strong> na sua conta. É só entrar com o seu e-mail e a sua senha.</p>
       ${button(`${base}/login`, "Acessar minha área")}`
    : `<ol style="padding-left:20px;margin:8px 0">
         <li style="margin:6px 0"><strong>Crie a sua conta</strong> usando exatamente este e-mail: <strong>${escapeHtml(email)}</strong>. É com ele que o seu acesso é liberado.</li>
         <li style="margin:6px 0"><strong>Confirme o e-mail:</strong> enviamos uma mensagem de confirmação para a sua caixa de entrada (olhe também o spam).</li>
         <li style="margin:6px 0"><strong>Pronto:</strong> o curso aparece sozinho em &ldquo;Meus cursos&rdquo;.</li>
       </ol>
       ${button(`${base}/cadastro`, "Criar minha conta")}
       <p style="color:#55687a;font-size:14px">Já tem conta com esse e-mail? <a href="${escapeHtml(`${base}/login`)}" style="color:#d6152d">Entre por aqui</a>.</p>`;

  const guarantee = `<p style="margin:22px 0 6px"><strong>Garantia de 7 dias</strong></p>
    <p style="margin:0">Você tem 7 dias, a partir da compra, para pedir o reembolso se o conteúdo não for o que esperava.${
      hold ? " Nesse período, parte das aulas é liberada aos poucos; o restante libera automaticamente no 8º dia." : ""
    }</p>`;

  const html = layout(`
    <p style="margin-top:0">Olá${hi ? `, ${escapeHtml(hi)}` : ""}!</p>
    <p>${free ? "O seu acesso foi liberado." : `Recebemos o seu pagamento de <strong>${escapeHtml(money(amountCents))}</strong> e a sua compra está <strong>confirmada</strong>.`}</p>
    <p style="margin-bottom:4px"><strong>O que você comprou:</strong></p>
    <ul style="padding-left:20px;margin:4px 0 16px">${list}</ul>
    <p style="margin:18px 0 6px"><strong>Como acessar</strong></p>
    ${access}
    ${guarantee}
    ${helpLine(whatsappUrl)}
    <p style="color:#7b8c9c;font-size:12px;margin-bottom:0">Pedido #${escapeHtml(shortId(orderId))}</p>
  `);
  return { subject: `Compra confirmada: ${titles[0] || "seu pedido"}`, html };
}

// Lembrete para quem pagou e ainda não criou a conta. stage 1 = primeiro lembrete, 2 = último.
export function accessReminderEmail({ name, email, title, stage, base, whatsappUrl }) {
  const hi = firstName(name);
  const html = layout(`
    <p style="margin-top:0">Olá${hi ? `, ${escapeHtml(hi)}` : ""}!</p>
    <p>O seu pagamento de <strong>${escapeHtml(title)}</strong> foi confirmado, mas ainda não encontramos uma conta com o e-mail <strong>${escapeHtml(email)}</strong>.</p>
    <p>O curso está guardado para você. Assim que criar a conta <strong>com esse mesmo e-mail</strong>, ele aparece sozinho em &ldquo;Meus cursos&rdquo;.</p>
    ${button(`${base}/cadastro`, "Criar minha conta")}
    <p style="color:#55687a;font-size:14px">Já criou a conta? <a href="${escapeHtml(`${base}/login`)}" style="color:#d6152d">Entre por aqui</a>. Se você usou outro e-mail no cadastro, fale com a gente para ajustarmos o seu acesso.</p>
    ${stage === 2 ? `<p style="color:#55687a;font-size:14px">Este é o último lembrete automático.</p>` : ""}
    ${helpLine(whatsappUrl)}
  `);
  return {
    subject: stage === 2 ? `Último lembrete: o seu acesso a ${title} está guardado` : `Falta só criar a sua conta para acessar ${title}`,
    html,
  };
}

async function loadContext(order) {
  const ids = [order.product_id, ...(order.bump_product_ids || [])].filter(Boolean);
  const [products, settings] = await Promise.all([
    ids.length ? sb(`products?id=in.(${ids.join(",")})&select=id,title,access_hold_enabled`).catch(() => []) : [],
    sb("site_settings?id=eq.1&select=whatsapp_url&limit=1").catch(() => []),
  ]);
  const byId = Object.fromEntries((products || []).map((product) => [product.id, product]));
  const ordered = ids.map((id) => byId[id]).filter(Boolean);
  return { products: ordered, whatsappUrl: settings?.[0]?.whatsapp_url || "" };
}

// Confirmação de compra. Chamada quando o pedido vira "pago". Nunca lança.
export async function sendPurchaseConfirmation(orderId) {
  const base = siteUrl();
  if (!base) return { skipped: "site_url_missing" };

  const rows = await sb(`orders?id=eq.${orderId}&select=id,status,user_id,buyer_name,buyer_email,amount_cents,product_id,bump_product_ids&limit=1`);
  const order = rows?.[0];
  if (!order || order.status !== "paid") return { skipped: "not_paid" };
  if (!validEmail(order.buyer_email)) return { skipped: "invalid_email" };

  // reserva o envio: só quem conseguir preencher buyer_email_sent_at (que estava vazio) envia
  const claimed = await sb(`orders?id=eq.${order.id}&buyer_email_sent_at=is.null`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { buyer_email_sent_at: new Date().toISOString(), buyer_email_error: null },
  });
  if (!claimed?.length) return { skipped: "already_sent" };

  try {
    const { products, whatsappUrl } = await loadContext(order);
    const { subject, html } = purchaseConfirmationEmail({
      name: order.buyer_name,
      email: order.buyer_email.trim(),
      titles: products.length ? products.map((product) => product.title) : ["Seu pedido"],
      amountCents: order.amount_cents,
      hasAccount: Boolean(order.user_id),
      hold: products.some((product) => product.access_hold_enabled),
      base,
      whatsappUrl,
      orderId: order.id,
    });
    await sendEmail({ to: order.buyer_email.trim(), subject, html });
    return { sent: true };
  } catch (error) {
    const reason = String(error?.message || error).slice(0, 300);
    console.error("buyer email error:", reason);
    // libera a reserva e guarda o motivo, para dar para ver o que houve no pedido
    await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { buyer_email_sent_at: null, buyer_email_error: reason } }).catch(() => null);
    await sendTelegram(`E-mail de confirmação NÃO enviado ao comprador\nPedido #${shortId(order.id)} - ${order.buyer_email}\nMotivo: ${reason}\nO acesso foi liberado normalmente; avise o aluno pelo WhatsApp.`).catch(() => null);
    return { error: true };
  }
}

// Lembretes de cadastro (rodam no robô diário). Só para pedidos pagos sem conta, pagos nos últimos 14 dias.
export async function runAccessReminders({ base, limit = 40 }) {
  const since = (ms) => new Date(Date.now() - ms).toISOString();
  const recent = `paid_at=gte.${since(14 * DAY)}`;
  const batches = [
    { stage: 1, from: 0, filter: `status=eq.paid&user_id=is.null&access_reminder_stage=eq.0&paid_at=lte.${since(2 * DAY)}&${recent}` },
    { stage: 2, from: 1, filter: `status=eq.paid&user_id=is.null&access_reminder_stage=eq.1&access_reminder_sent_at=lte.${since(4 * DAY)}&${recent}` },
  ];

  const result = { sent: 0, errors: 0 };
  let remaining = limit;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const rows = (await sb(`orders?${batch.filter}&select=id,buyer_name,buyer_email,product_id&order=paid_at.asc&limit=${remaining}`)) || [];
    for (const order of rows) {
      if (!validEmail(order.buyer_email)) continue;
      // reserva a etapa antes de enviar (duas execuções ao mesmo tempo não duplicam)
      const claimed = await sb(`orders?id=eq.${order.id}&user_id=is.null&access_reminder_stage=eq.${batch.from}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: { access_reminder_stage: batch.stage, access_reminder_sent_at: new Date().toISOString() },
      }).catch(() => null);
      if (!claimed?.length) continue;
      remaining -= 1;
      try {
        const [products, settings] = await Promise.all([
          sb(`products?id=eq.${order.product_id}&select=title&limit=1`).catch(() => []),
          sb("site_settings?id=eq.1&select=whatsapp_url&limit=1").catch(() => []),
        ]);
        const { subject, html } = accessReminderEmail({
          name: order.buyer_name,
          email: order.buyer_email.trim(),
          title: products?.[0]?.title || "o seu curso",
          stage: batch.stage,
          base,
          whatsappUrl: settings?.[0]?.whatsapp_url || "",
        });
        await sendEmail({ to: order.buyer_email.trim(), subject, html });
        result.sent += 1;
      } catch (error) {
        console.error("access reminder error:", order.id, String(error?.message || error).slice(0, 200));
        // devolve a etapa: o robô tenta de novo no próximo dia
        await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: { access_reminder_stage: batch.from } }).catch(() => null);
        result.errors += 1;
      }
    }
  }
  return result;
}
