// Cliente das funções /api/r2-* (servidor). As chaves do Cloudflare R2 nunca chegam ao navegador:
// aqui só trafegam o JWT do usuário logado e os links de upload/download de curta duração.
import { supabase } from "./supabase";

export class R2Error extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY = {
  not_deployed: "O envio/download de arquivo não está disponível neste ambiente. Funciona no site publicado (Vercel).",
  r2_not_configured: "O armazenamento de arquivos (Cloudflare R2) ainda não foi configurado nas variáveis de ambiente.",
  network: "Sem conexão com o servidor. Tente novamente.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
  forbidden: "Você não tem acesso a este arquivo.",
  not_found: "Este item não tem arquivo cadastrado.",
};

async function api(path, { method = "GET", body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new R2Error("unauthenticated", FRIENDLY.unauthenticated);

  let response;
  try {
    response = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new R2Error("network", FRIENDLY.network);
  }

  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json().catch(() => null) : null;

  // Em desenvolvimento (vite) /api cai no index.html: a função não existe.
  if (!payload) throw new R2Error("not_deployed", FRIENDLY.not_deployed);
  if (!response.ok) {
    const code = payload.error || "error";
    throw new R2Error(code, payload.message || FRIENDLY[code] || "Não foi possível concluir a operação com o arquivo.");
  }
  return payload;
}

// Admin: pede um link de envio temporário e já sobe o PDF direto pro R2 (não passa pelo nosso servidor).
export async function uploadFileToR2({ kind, file }) {
  if (file.type !== "application/pdf") throw new R2Error("invalid_type", "Escolha um arquivo em PDF.");
  const { url, key } = await api("/api/r2-sign", { method: "POST", body: { action: "upload", kind, contentType: file.type } });
  let putResponse;
  try {
    putResponse = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  } catch {
    throw new R2Error("network", "Falha ao enviar o arquivo. Tente novamente.");
  }
  if (!putResponse.ok) throw new R2Error("upload_failed", "Falha ao enviar o arquivo.");
  return { key, name: file.name };
}

// Aluno (ou admin): pede um link de download temporário (expira em poucos minutos) pro arquivo de
// um produto ("product") ou de uma aula ("lesson").
export const getR2DownloadUrl = (kind, id) => api("/api/r2-sign", { method: "POST", body: { action: "download", kind, id } });
