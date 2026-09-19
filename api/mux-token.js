// POST /api/mux-token  { lessonId }
// Entrega os tokens assinados (curta duração) para tocar uma aula protegida.
// Só devolve token se o RLS do Supabase deixar o usuário LER a aula: administrador, ou aluno com
// acesso ativo ao produto e aula publicada. Sem token válido o Mux não entrega o vídeo.
import {
  HttpError,
  PLAYBACK_TOKEN_TTL_SECONDS,
  fetchLessonForUser,
  handler,
  readBody,
  requireMuxConfig,
  requireUser,
  sendJson,
  signPlaybackToken,
} from "./_lib/mux.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default handler(["POST"], async (req, res) => {
  const { token } = await requireUser(req);
  const { lessonId } = readBody(req);
  if (!UUID.test(String(lessonId || ""))) throw new HttpError(400, "invalid_lesson", "lessonId inválido.");

  const lesson = await fetchLessonForUser(lessonId, token);
  if (!lesson || lesson.video_provider !== "mux") {
    throw new HttpError(403, "forbidden", "Você não tem acesso a esta aula.");
  }
  if (lesson.mux_status !== "ready" || !lesson.mux_playback_id) {
    throw new HttpError(409, "not_ready", "Este vídeo ainda está sendo processado. Tente novamente em alguns minutos.");
  }

  const { signingKeyId, signingKeyPrivate } = requireMuxConfig(["signingKeyId", "signingKeyPrivate"]);
  const sign = (audience) =>
    signPlaybackToken({
      playbackId: lesson.mux_playback_id,
      audience,
      keyId: signingKeyId,
      privateKey: signingKeyPrivate,
    });

  sendJson(res, 200, {
    playbackId: lesson.mux_playback_id,
    tokens: { playback: sign("v"), thumbnail: sign("t"), storyboard: sign("s") },
    expiresIn: PLAYBACK_TOKEN_TTL_SECONDS,
  });
});
