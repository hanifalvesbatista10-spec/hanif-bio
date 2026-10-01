// GET /api/cron-recover-sales
// Manda até 2 lembretes por pedido para quem abandonou o carrinho ou teve o pagamento recusado:
//  1) logo depois (para pegar quem ainda está "quente" na compra);
//  2) no dia seguinte, como último lembrete.
// Nunca manda para quem já pagou (a busca sempre exige status pending/failed, então um pedido pago some da
// lista sozinho) nem para quem clicou em "não quero mais receber" no e-mail (recovery_opt_out).
// Chamado pelo agendador da Vercel (vercel.json > crons, uma vez por dia no plano gratuito). Para lembretes
// mais rápidos (o ideal, poucas horas depois do abandono), veja docs/checkout.md: dá para apontar um
// agendador externo gratuito (ex.: cron-job.org) para esta mesma URL a cada 20-30 minutos — é seguro chamar
// várias vezes, porque cada pedido só recebe cada lembrete uma vez.
// Protegido por CRON_SECRET: exige o cabeçalho "Authorization: Bearer <CRON_SECRET>". Sem essa variável
// configurada, a rota fica BLOQUEADA (ninguém consegue chamar) até você configurá-la na Vercel.
import crypto from "node:crypto";
import { HttpError } from "./_lib/mux.js";
import { checkoutHandler, sb, siteUrl } from "./_lib/checkout.js";
import { sendEmail } from "./_lib/resend.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function verifyCron(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) {
    console.warn("cron-recover-sales: CRON_SECRET não configurado, a rota está bloqueada.");
    return false;
  }
  return (req.headers.authorization || "") === `Bearer ${secret}`;
}

// Token simples (HMAC) para o link de "não quero mais receber" do e-mail, sem precisar de outra tabela.
function unsubscribeUrl(base, orderId) {
  const secret = process.env.CRON_SECRET || "";
  const token = crypto.createHmac("sha256", secret).update(orderId).digest("hex").slice(0, 24);
  return `${base}/api/recovery-opt-out?order=${encodeURIComponent(orderId)}&token=${token}`;
}

function emailHtml({ name, intro, url, coupon, unsub }) {
  const firstName = String(name || "").trim().split(/\s+/)[0] || "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#13283c;line-height:1.6">
    <p>Oi${firstName ? ` ${firstName}` : ""},</p>
    <p>${intro}</p>
    ${coupon ? `<p>Use o cupom <strong>${coupon}</strong> para um desconto especial nesta compra.</p>` : ""}
    <p style="margin:28px 0">
      <a href="${url}" style="background:#d6152d;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Concluir minha compra</a>
    </p>
    <p style="color:#7b8c9c;font-size:12px">Se preferir não receber estes lembretes, <a href="${unsub}" style="color:#7b8c9c">clique aqui</a>.</p>
  </div>`;
}

async function processBatch({ base, settings, filter, stage, subject, intro }) {
  const rows = (await sb(`orders?${filter}&select=id,buyer_name,buyer_email,product_id&order=created_at.asc&limit=80`)) || [];
  let sent = 0;
  const errors = [];
  for (const order of rows) {
    if (!order.buyer_email) continue;
    try {
      const products = await sb(`products?id=eq.${order.product_id}&select=title,slug&limit=1`);
      const product = products?.[0];
      if (!product?.slug) continue;
      const url = `${base}/checkout/${product.slug}${settings.coupon_code ? `?cupom=${encodeURIComponent(settings.coupon_code)}` : ""}`;
      await sendEmail({
        to: order.buyer_email,
        subject,
        html: emailHtml({
          name: order.buyer_name,
          intro: intro(product.title),
          url,
          coupon: settings.coupon_code,
          unsub: unsubscribeUrl(base, order.id),
        }),
      });
      await sb(`orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: { recovery_stage: stage, recovery_last_sent_at: new Date().toISOString() },
      });
      sent += 1;
    } catch (error) {
      console.error("cron-recover-sales: falha ao enviar", order.id, error.message);
      errors.push(order.id);
    }
  }
  return { sent, errors };
}

export default checkoutHandler(["GET", "POST"], async (req, res) => {
  if (!verifyCron(req)) throw new HttpError(401, "unauthorized", "Não autorizado.");

  const base = siteUrl();
  const settingsRows = await sb("recovery_settings?id=eq.1&select=*&limit=1").catch(() => null);
  const settings = settingsRows?.[0];

  if (!settings?.enabled || !base) {
    res.status(200).setHeader("Cache-Control", "no-store").json({
      skipped: true,
      reason: !base ? "SITE_URL não configurado" : !settingsRows ? "supabase/29_recuperacao_de_vendas.sql ainda não foi executado" : "recuperação desligada em Recuperação de vendas",
    });
    return;
  }

  const since = (ms) => new Date(Date.now() - ms).toISOString();
  const common = `recovery_opt_out=eq.false`;

  const abandoned = await processBatch({
    base, settings, stage: 1,
    filter: `status=eq.pending&${common}&recovery_stage=eq.0&created_at=lte.${since(45 * 60 * 1000)}&created_at=gte.${since(3 * DAY)}`,
    subject: "Você deixou sua compra pela metade",
    intro: (title) => `Vimos que você começou a comprar <strong>${title}</strong> mas não finalizou. Seu carrinho ainda está esperando por você.`,
  });
  const failed = await processBatch({
    base, settings, stage: 1,
    filter: `status=eq.failed&${common}&recovery_stage=eq.0&created_at=lte.${since(15 * 60 * 1000)}&created_at=gte.${since(3 * DAY)}`,
    subject: "Seu pagamento não foi aprovado",
    intro: (title) => `Seu pagamento de <strong>${title}</strong> não foi aprovado. Isso costuma acontecer por falta de limite no cartão ou um dado digitado errado. Tente de novo com outro cartão, Pix ou boleto.`,
  });
  const lastChance = await processBatch({
    base, settings, stage: 2,
    filter: `status=in.(pending,failed)&${common}&recovery_stage=eq.1&recovery_last_sent_at=lte.${since(23 * HOUR)}&created_at=gte.${since(7 * DAY)}`,
    subject: "Última chance: seu acesso está reservado",
    intro: (title) => `Este é o último lembrete sobre <strong>${title}</strong>. Depois de hoje, paramos de avisar por e-mail.`,
  });

  res.status(200).setHeader("Cache-Control", "no-store").json({
    at: new Date().toISOString(),
    abandonado: abandoned,
    recusado: failed,
    ultimoLembrete: lastChance,
  });
});
