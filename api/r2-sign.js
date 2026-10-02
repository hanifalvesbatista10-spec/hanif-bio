// POST /api/r2-sign   { action: "upload" | "download", kind: "product" | "lesson", id?, contentType? }
// Junta upload e download numa função só (o plano grátis da Vercel tem limite de 12 funções de
// servidor). "upload" é só admin e devolve um link temporário de envio direto pro R2. "download"
// confere a posse pelo RLS do Supabase (token do próprio usuário) e devolve um link temporário de
// download — nenhum dos dois link fica fixo, os dois expiram em poucos minutos.
import { handler, requireAdmin, requireUser, readBody, HttpError } from "./_lib/mux.js";
import { presignUpload, presignDownload } from "./_lib/r2.js";

const PREFIX = { product: "ebooks", lesson: "lesson-files" };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://qgenfhyzobauknptwsex.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5maHl6b2JhdWtucHR3c2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzA3MTAsImV4cCI6MjEwMTI0NjcxMH0.q8_C-d2aJR9uiEI0-BamD3Ee8it-wxzQynSCJjKvmsA";

// Lê pelo PostgREST com o JWT do usuário: o RLS decide sozinho o que ele pode ver.
async function sbAsUser(path, token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function handleUpload(req, res) {
  await requireAdmin(req);
  const body = readBody(req);
  const kind = body.kind;
  const contentType = String(body.contentType || "").trim();

  if (!PREFIX[kind]) throw new HttpError(400, "invalid_kind", "Tipo de arquivo inválido.");
  if (contentType !== "application/pdf") throw new HttpError(400, "invalid_type", "Só é permitido enviar arquivo em PDF.");

  const key = `${PREFIX[kind]}/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const url = await presignUpload(key, contentType);
  res.status(200).setHeader("Cache-Control", "no-store").json({ url, key });
}

async function handleDownload(req, res) {
  const { token } = await requireUser(req);
  const body = readBody(req);
  const kind = body.kind;
  const id = String(body.id || "").trim();
  if (!id || !["product", "lesson"].includes(kind)) throw new HttpError(400, "invalid_request", "Pedido inválido.");

  let path = null;
  let filename = null;

  if (kind === "product") {
    const rows = await sbAsUser(
      `user_products?product_id=eq.${encodeURIComponent(id)}&access_status=eq.active&select=product:products(ebook_file_path,ebook_file_name)&limit=1`,
      token
    );
    const product = rows?.[0]?.product;
    if (!product) throw new HttpError(403, "forbidden", "Você não tem acesso a este produto.");
    path = product.ebook_file_path;
    filename = product.ebook_file_name;
  } else {
    const rows = await sbAsUser(
      `product_lessons?id=eq.${encodeURIComponent(id)}&select=attachment_file_path,attachment_file_name`,
      token
    );
    const lesson = rows?.[0];
    if (!lesson) throw new HttpError(403, "forbidden", "Você não tem acesso a esta aula.");
    path = lesson.attachment_file_path;
    filename = lesson.attachment_file_name;
  }

  if (!path) throw new HttpError(404, "not_found", "Este item não tem arquivo para baixar.");

  const url = await presignDownload(path, filename);
  res.status(200).setHeader("Cache-Control", "no-store").json({ url, filename: filename || "arquivo.pdf" });
}

export default handler(["POST"], async (req, res) => {
  const body = readBody(req);
  if (body.action === "upload") return handleUpload(req, res);
  if (body.action === "download") return handleDownload(req, res);
  throw new HttpError(400, "invalid_action", "Ação inválida.");
});
