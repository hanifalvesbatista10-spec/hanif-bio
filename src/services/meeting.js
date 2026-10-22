// Cliente da função /api/meeting (servidor). A chave do Daily nunca chega ao navegador: aqui só trafega o
// JWT do usuário logado e o endereço da sala já com um token de entrada de curta duração.
import { supabase } from "./supabase";

export class MeetingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY = {
  not_deployed: "A sala de reunião não está disponível neste ambiente. Funciona no site publicado (Vercel).",
  daily_not_configured: "As reuniões ainda não foram configuradas no servidor.",
  network: "Sem conexão com o servidor. Tente novamente.",
  unauthenticated: "Sua sessão expirou. Entre novamente.",
  forbidden: "Você não tem acesso a este encontro.",
  too_early: "A sala abre 30 minutos antes do horário do encontro.",
  ended: "Este encontro já terminou.",
};

export async function getMeetingUrl(meetingId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new MeetingError("unauthenticated", FRIENDLY.unauthenticated);

  let response;
  try {
    response = await fetch("/api/meeting", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    });
  } catch {
    throw new MeetingError("network", FRIENDLY.network);
  }

  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json().catch(() => null) : null;
  if (!payload) throw new MeetingError("not_deployed", FRIENDLY.not_deployed);
  if (!response.ok) {
    const code = payload.error || "error";
    throw new MeetingError(code, FRIENDLY[code] || payload.message || "Não foi possível entrar na sala agora.");
  }
  return payload;
}

// A sala abre 30 minutos antes e o aluno ainda consegue entrar até 1 hora depois do fim (mesma regra do servidor).
// Se o administrador encerrou antes (ended_at), o encontro acaba ali.
export function meetingWindow(meeting, now = Date.now()) {
  const start = new Date(meeting.starts_at).getTime();
  const end = start + meeting.duration_minutes * 60 * 1000;
  if (meeting.ended_at && now >= new Date(meeting.ended_at).getTime()) return "ended";
  if (now < start - 30 * 60 * 1000) return "soon";
  if (now > end + 60 * 60 * 1000) return "ended";
  return "open";
}

// "Ao vivo agora": do início da janela de entrada (30 min antes) até o fim da duração marcada, sem encerramento antecipado.
// Passou da duração, o aviso some sozinho; o painel pode prolongar (+30 min) ou encerrar antes.
export function meetingLive(meeting, now = Date.now()) {
  const start = new Date(meeting.starts_at).getTime();
  const end = start + meeting.duration_minutes * 60 * 1000;
  if (meeting.ended_at && now >= new Date(meeting.ended_at).getTime()) return false;
  return now >= start - 30 * 60 * 1000 && now <= end;
}
