// POST /api/r2-sign-download   { kind: "product" | "lesson", id }
// Devolve um link temporário (5 min) de download do arquivo de um produto (e-book) ou de uma aula
// (material). A posse é conferida pelo RLS do Supabase usando o token do PRÓPRIO usuário — nunca
// confia em nada que o navegador mande além do id.
import { handler, requireUser, readBody, HttpError } from "./_lib/mux.js";
import { presignDownload } from "./_lib/r2.js";

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

export default handler(["POST"], async (req, res) => {
  const { token } = await requireUser(req);
  const body = readBody(req);
  const kind = body.kind;
  const id = String(body.id || "").trim();
  if (!id || !["product", "lesson"].includes(kind)) throw new HttpError(400, "invalid_request", "Pedido inválido.");

  let path = null;
  let filename = null;

  if (kind === "product") {
    // user_products só mostra linha do próprio usuário (RLS); o embed em products é liberado
    // publicamente para produto ativo/oculto, então uma consulta só já basta.
    const rows = await sbAsUser(
      `user_products?product_id=eq.${encodeURIComponent(id)}&access_status=eq.active&select=product:products(ebook_file_path,ebook_file_name)&limit=1`,
      token
    );
    const product = rows?.[0]?.product;
    if (!product) throw new HttpError(403, "forbidden", "Você não tem acesso a este produto.");
    path = product.ebook_file_path;
    filename = product.ebook_file_name;
  } else {
    // A política "students with access read lessons" só devolve a linha se o aluno tiver acesso
    // (ou for admin); sem acesso, a lista vem vazia — não precisa checar posse de novo aqui.
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
});
