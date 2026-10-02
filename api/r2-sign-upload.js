// POST /api/r2-sign-upload   { kind: "product" | "lesson", contentType }
// Só admin. Devolve um link temporário de envio direto pro Cloudflare R2 (o arquivo não passa
// pelo nosso servidor) e a chave (key) onde ele vai ficar — salve essa chave no produto/aula.
import { handler, requireAdmin, readBody, HttpError } from "./_lib/mux.js";
import { presignUpload } from "./_lib/r2.js";

const PREFIX = { product: "ebooks", lesson: "lesson-files" };

export default handler(["POST"], async (req, res) => {
  await requireAdmin(req);
  const body = readBody(req);
  const kind = body.kind;
  const contentType = String(body.contentType || "").trim();

  if (!PREFIX[kind]) throw new HttpError(400, "invalid_kind", "Tipo de arquivo inválido.");
  if (contentType !== "application/pdf") throw new HttpError(400, "invalid_type", "Só é permitido enviar arquivo em PDF.");

  const key = `${PREFIX[kind]}/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const url = await presignUpload(key, contentType);

  res.status(200).setHeader("Cache-Control", "no-store").json({ url, key });
});
