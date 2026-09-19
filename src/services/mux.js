// Cliente das funções /api/mux-* (servidor). As chaves do Mux nunca chegam ao navegador:
// aqui só trafegam o JWT do usuário logado e os tokens de reprodução de curta duração.
import { supabase } from "./supabase";

export class MuxError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY = {
  not_deployed: "As funções do Mux não estão disponíveis neste ambiente. Elas funcionam no site publicado (Vercel).",
  mux_not_configured: "A integração com o Mux ainda não foi configurada. Veja docs/mux-setup.md.",
  network: "Sem conexão com o servidor. Tente novamente.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
};

async function api(path, { method = "GET", body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new MuxError("unauthenticated", FRIENDLY.unauthenticated);

  let response;
  try {
    response = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new MuxError("network", FRIENDLY.network);
  }

  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json().catch(() => null) : null;

  // Em desenvolvimento (vite) /api cai no index.html: a função não existe.
  if (!payload) throw new MuxError("not_deployed", FRIENDLY.not_deployed);
  if (!response.ok) {
    const code = payload.error || "error";
    throw new MuxError(code, payload.message || FRIENDLY[code] || "Não foi possível concluir a operação no Mux.");
  }
  return payload;
}

export const createMuxUpload = () => api("/api/mux-upload", { method: "POST" });

export const getMuxUploadState = (uploadId) => api(`/api/mux-asset?uploadId=${encodeURIComponent(uploadId)}`);

export const deleteMuxAsset = (assetId) => api(`/api/mux-asset?assetId=${encodeURIComponent(assetId)}`, { method: "DELETE" });

export const fetchMuxTokens = (lessonId) => api("/api/mux-token", { method: "POST", body: { lessonId } });

// Envia o arquivo direto ao Mux em pedaços (retoma se a conexão cair).
export async function uploadFileToMux({ file, url, onProgress }) {
  const { createUpload } = await import("@mux/upchunk");
  return new Promise((resolve, reject) => {
    const upload = createUpload({ endpoint: url, file, chunkSize: 5120 });
    upload.on("progress", (event) => onProgress?.(Math.round(event.detail)));
    upload.on("error", (event) => reject(new MuxError("upload_failed", event.detail?.message || "Falha ao enviar o vídeo.")));
    upload.on("success", () => resolve());
  });
}

export function formatDuration(seconds) {
  const total = Number(seconds) || 0;
  if (total <= 0) return "";
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}min${rest ? ` ${String(rest).padStart(2, "0")}s` : ""}` : `${rest}s`;
}
