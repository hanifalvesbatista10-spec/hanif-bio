// POST /api/meeting  { meetingId }
// Devolve o endereço da sala do Daily.co para o usuário entrar, já com um token só dele (curta duração).
// Quem pode entrar: o administrador (entra como dono da sala) e o aluno com acesso ativo ao produto do
// encontro — a leitura do encontro passa pelo RLS com o token do próprio usuário, então só volta linha para
// quem tem direito. A sala é criada no Daily no primeiro acesso (privada: sem token ninguém entra).
import { HttpError, handler, readBody, requireUser, sendJson } from "./_lib/mux.js";

const DAILY = "https://api.daily.co/v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EARLY_JOIN_MS = 30 * 60 * 1000;
const LATE_JOIN_MS = 60 * 60 * 1000;
const ROOM_EXTRA_MS = 12 * 60 * 60 * 1000;

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://qgenfhyzobauknptwsex.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5maHl6b2JhdWtucHR3c2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzA3MTAsImV4cCI6MjEwMTI0NjcxMH0.q8_C-d2aJR9uiEI0-BamD3Ee8it-wxzQynSCJjKvmsA";

async function sbAsUser(path, token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
}

async function daily(path, { method = "GET", body } = {}) {
  const response = await fetch(`${DAILY}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.info || data?.error || `Daily ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Sala com nome fixo por encontro: se dois alunos entram ao mesmo tempo, o segundo só reaproveita a sala.
async function ensureRoom(name, expSeconds) {
  try {
    return await daily("/rooms", {
      method: "POST",
      body: {
        name,
        privacy: "private",
        properties: { exp: expSeconds, eject_at_room_exp: true, enable_prejoin_ui: true },
      },
    });
  } catch (error) {
    if (error.status !== 400 && error.status !== 409) throw error;
    return daily(`/rooms/${name}`);
  }
}

export default handler(["POST"], async (req, res) => {
  const { user, token } = await requireUser(req);
  if (!process.env.DAILY_API_KEY) {
    throw new HttpError(503, "daily_not_configured", "As reuniões ainda não foram configuradas (falta DAILY_API_KEY na Vercel).");
  }

  const meetingId = String(readBody(req).meetingId || "");
  if (!UUID.test(meetingId)) throw new HttpError(400, "invalid_meeting", "Encontro inválido.");

  const meetings = await sbAsUser(`live_meetings?id=eq.${meetingId}&select=id,title,starts_at,duration_minutes`, token);
  const meeting = meetings?.[0];
  if (!meeting) throw new HttpError(403, "forbidden", "Você não tem acesso a este encontro.");

  const profiles = await sbAsUser(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role,full_name,account_status`, token);
  const profile = profiles?.[0];
  const isAdmin = profile?.role === "admin" && profile?.account_status === "active";

  const start = new Date(meeting.starts_at).getTime();
  const end = start + meeting.duration_minutes * 60 * 1000;
  const now = Date.now();
  if (!isAdmin) {
    if (now < start - EARLY_JOIN_MS) throw new HttpError(425, "too_early", "A sala abre 30 minutos antes do horário do encontro.");
    if (now > end + LATE_JOIN_MS) throw new HttpError(410, "ended", "Este encontro já terminou.");
  }

  const roomName = `ha-${meeting.id}`;
  const roomExp = Math.floor((Math.max(end, now) + ROOM_EXTRA_MS) / 1000);
  let room;
  try {
    room = await ensureRoom(roomName, roomExp);
  } catch (error) {
    console.error("daily room error:", error.status || "", error.message);
    throw new HttpError(502, "daily_error", "Não foi possível abrir a sala agora. Tente novamente em instantes.");
  }

  let meetingToken;
  try {
    const result = await daily("/meeting-tokens", {
      method: "POST",
      body: {
        properties: {
          room_name: roomName,
          user_name: profile?.full_name || (isAdmin ? "Hanif Alves" : "Aluno"),
          is_owner: isAdmin,
          exp: Math.floor((Math.max(end, now) + LATE_JOIN_MS) / 1000),
        },
      },
    });
    meetingToken = result.token;
  } catch (error) {
    console.error("daily token error:", error.status || "", error.message);
    throw new HttpError(502, "daily_error", "Não foi possível entrar na sala agora. Tente novamente em instantes.");
  }

  sendJson(res, 200, { url: `${room.url}?t=${meetingToken}`, isOwner: isAdmin });
});
