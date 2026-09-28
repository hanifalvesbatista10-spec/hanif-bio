// GET /api/recovery-opt-out?order=<id>&token=<hmac>
// Link de "não quero mais receber" nos e-mails de recuperação de vendas (api/cron-recover-sales.js).
// O token é um HMAC do id do pedido com o CRON_SECRET: sem ele, ninguém consegue calar o lembrete de
// outra pessoa só adivinhando o id do pedido.
import crypto from "node:crypto";
import { sb } from "./_lib/checkout.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE = (message) => `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recuperação de vendas</title>
<body style="font-family:Arial,Helvetica,sans-serif;padding:60px 24px;text-align:center;color:#13283c;background:#f4f6f9">
<p style="max-width:420px;margin:0 auto;font-size:1.05rem">${message}</p>
</body>`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const orderId = String(req.query?.order || "").trim();
  const token = String(req.query?.token || "").trim();
  const secret = process.env.CRON_SECRET || "";
  const expected = secret && UUID.test(orderId) ? crypto.createHmac("sha256", secret).update(orderId).digest("hex").slice(0, 24) : "";

  if (!expected || token !== expected) {
    res.status(400).send(PAGE("Link inválido ou expirado."));
    return;
  }

  await sb(`orders?id=eq.${orderId}`, { method: "PATCH", body: { recovery_opt_out: true } }).catch((error) => {
    console.error("recovery-opt-out:", error.message);
  });

  res.status(200).send(PAGE("Pronto — você não vai mais receber estes lembretes sobre este pedido."));
}
