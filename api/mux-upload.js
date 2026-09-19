// POST /api/mux-upload  (somente administrador)
// Cria uma "direct upload" no Mux com política de reprodução ASSINADA e devolve a URL para o
// navegador enviar o arquivo direto ao Mux (o vídeo não passa pelo nosso servidor).
import { handler, muxRequest, requireAdmin, requireMuxConfig, sendJson } from "./_lib/mux.js";

export default handler(["POST"], async (req, res) => {
  await requireAdmin(req);
  requireMuxConfig(["tokenId", "tokenSecret", "signingKeyId", "signingKeyPrivate"]);

  const origin = req.headers.origin || "*";
  const { data } = await muxRequest("/video/v1/uploads", {
    method: "POST",
    body: {
      cors_origin: origin,
      new_asset_settings: {
        playback_policies: ["signed"],
        video_quality: "basic",
      },
    },
  });

  sendJson(res, 201, { uploadId: data.id, url: data.url });
});
