// Utilitários compartilhados pelas funções /api/mux-*.
// Roda no servidor (Vercel). As chaves do Mux vêm de variáveis de ambiente e NUNCA vão para o navegador.
import { createSign } from "node:crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://qgenfhyzobauknptwsex.supabase.co";
// Chave pública (anon): a mesma que o site já usa. A segurança vem do RLS + do JWT do usuário.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5maHl6b2JhdWtucHR3c2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzA3MTAsImV4cCI6MjEwMTI0NjcxMH0.q8_C-d2aJR9uiEI0-BamD3Ee8it-wxzQynSCJjKvmsA";

const MUX_API = "https://api.mux.com";
export const PLAYBACK_TOKEN_TTL_SECONDS = 4 * 60 * 60;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

// Envolve o handler: método permitido, tratamento de erro padronizado.
export function handler(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader("Allow", methods.join(", "));
        throw new HttpError(405, "method_not_allowed", "Método não permitido.");
      }
      await fn(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.code, message: error.message });
      } else {
        console.error("mux api error:", error);
        sendJson(res, 500, { error: "internal_error", message: "Erro interno ao falar com o Mux." });
      }
    }
  };
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new HttpError(400, "invalid_json", "Corpo da requisição inválido.");
    }
  }
  return {};
}

export function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "unauthenticated", "Faça login para continuar.");
  return match[1];
}

async function supabaseFetch(path, token) {
  return fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
}

// Confere o JWT no Supabase Auth e devolve o usuário.
export async function requireUser(req) {
  const token = bearerToken(req);
  const response = await supabaseFetch("/auth/v1/user", token);
  if (!response.ok) throw new HttpError(401, "unauthenticated", "Sessão inválida ou expirada.");
  const user = await response.json();
  if (!user?.id) throw new HttpError(401, "unauthenticated", "Sessão inválida ou expirada.");
  return { user, token };
}

// Só administradores ativos (mesma regra do RLS: profiles.role = admin e account_status = active).
export async function requireAdmin(req) {
  const { user, token } = await requireUser(req);
  const response = await supabaseFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,account_status`,
    token
  );
  const rows = response.ok ? await response.json() : [];
  const profile = rows[0];
  if (!profile || profile.role !== "admin" || profile.account_status !== "active") {
    throw new HttpError(403, "forbidden", "Apenas administradores podem fazer isso.");
  }
  return { user, token };
}

// A leitura da aula passa pelo RLS com o token do usuário: só volta linha se ele é admin
// ou aluno com acesso ativo ao produto e a aula está publicada.
export async function fetchLessonForUser(lessonId, token) {
  const response = await supabaseFetch(
    `/rest/v1/product_lessons?id=eq.${encodeURIComponent(lessonId)}&select=id,status,video_provider,mux_playback_id,mux_status`,
    token
  );
  if (!response.ok) throw new HttpError(403, "forbidden", "Sem permissão para esta aula.");
  const rows = await response.json();
  return rows[0] || null;
}

export function muxConfig() {
  const config = {
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
    signingKeyId: process.env.MUX_SIGNING_KEY_ID,
    signingKeyPrivate: process.env.MUX_SIGNING_KEY_PRIVATE,
  };
  return config;
}

export function requireMuxConfig(keys) {
  const config = muxConfig();
  const names = {
    tokenId: "MUX_TOKEN_ID",
    tokenSecret: "MUX_TOKEN_SECRET",
    signingKeyId: "MUX_SIGNING_KEY_ID",
    signingKeyPrivate: "MUX_SIGNING_KEY_PRIVATE",
  };
  const missing = keys.filter((key) => !config[key]).map((key) => names[key]);
  if (missing.length) {
    throw new HttpError(
      503,
      "mux_not_configured",
      `Integração com o Mux não configurada. Faltam as variáveis: ${missing.join(", ")}.`
    );
  }
  return config;
}

export async function muxRequest(path, { method = "GET", body } = {}) {
  const { tokenId, tokenSecret } = requireMuxConfig(["tokenId", "tokenSecret"]);
  const response = await fetch(`${MUX_API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return { status: 204, data: null };
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new HttpError(502, "mux_auth_failed", "O Mux recusou as credenciais (MUX_TOKEN_ID / MUX_TOKEN_SECRET).");
    }
    const detail = payload?.error?.messages?.join(" ") || payload?.error?.type || `HTTP ${response.status}`;
    throw new HttpError(response.status === 404 ? 404 : 502, "mux_error", `Mux: ${detail}`);
  }
  return { status: response.status, data: payload?.data ?? null };
}

const base64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function privateKeyPem(value) {
  return value.includes("-----BEGIN") ? value.replace(/\\n/g, "\n") : Buffer.from(value, "base64").toString("utf8");
}

// JWT RS256 no formato do Mux: sub = playback id, aud = v | t | s, exp em segundos.
export function signPlaybackToken({ playbackId, audience, keyId, privateKey, ttlSeconds = PLAYBACK_TOKEN_TTL_SECONDS, now = Date.now() }) {
  const header = { alg: "RS256", typ: "JWT", kid: keyId };
  const payload = { sub: playbackId, aud: audience, exp: Math.floor(now / 1000) + ttlSeconds, kid: keyId };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKeyPem(privateKey));
  return `${unsigned}.${base64url(signature)}`;
}
