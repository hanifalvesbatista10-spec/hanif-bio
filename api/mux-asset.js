// POST   /api/mux-asset                → cria uma "direct upload" assinada e devolve a URL para o navegador
//                                        enviar o arquivo direto ao Mux (o vídeo não passa pelo nosso servidor)
// GET    /api/mux-asset?uploadId=...  → estado do vídeo enviado (processando / pronto / erro)
// DELETE /api/mux-asset?assetId=...   → apaga o vídeo no Mux (evita cobrança de armazenamento)
// Somente administrador. (O POST era a função /api/mux-upload, juntada aqui por causa do limite de 12
// funções do plano grátis da Vercel.)
import { HttpError, handler, muxRequest, requireAdmin, requireMuxConfig, sendJson } from "./_lib/mux.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

export default handler(["GET", "DELETE", "POST"], async (req, res) => {
  await requireAdmin(req);

  if (req.method === "POST") {
    requireMuxConfig(["tokenId", "tokenSecret", "signingKeyId", "signingKeyPrivate"]);
    const { data } = await muxRequest("/video/v1/uploads", {
      method: "POST",
      body: {
        cors_origin: req.headers.origin || "*",
        new_asset_settings: { playback_policies: ["signed"], video_quality: "basic" },
      },
    });
    return sendJson(res, 201, { uploadId: data.id, url: data.url });
  }

  if (req.method === "DELETE") {
    const assetId = String(req.query?.assetId || "");
    if (!ID_PATTERN.test(assetId)) throw new HttpError(400, "invalid_asset", "assetId inválido.");
    try {
      await muxRequest(`/video/v1/assets/${assetId}`, { method: "DELETE" });
    } catch (error) {
      // Já removido no Mux: tudo bem.
      if (!(error instanceof HttpError && error.status === 404)) throw error;
    }
    return sendJson(res, 200, { deleted: true });
  }

  const uploadId = String(req.query?.uploadId || "");
  if (!ID_PATTERN.test(uploadId)) throw new HttpError(400, "invalid_upload", "uploadId inválido.");

  const { data: upload } = await muxRequest(`/video/v1/uploads/${uploadId}`);

  if (upload.status === "errored" || upload.status === "cancelled" || upload.status === "timed_out") {
    return sendJson(res, 200, { state: "errored", detail: upload.status });
  }
  if (!upload.asset_id) {
    return sendJson(res, 200, { state: "waiting" });
  }

  const { data: asset } = await muxRequest(`/video/v1/assets/${upload.asset_id}`);
  const signed = (asset.playback_ids || []).find((item) => item.policy === "signed");

  if (asset.status === "errored") {
    return sendJson(res, 200, { state: "errored", assetId: asset.id, detail: "asset_errored" });
  }
  if (asset.status !== "ready" || !signed) {
    return sendJson(res, 200, { state: "processing", assetId: asset.id });
  }

  sendJson(res, 200, {
    state: "ready",
    assetId: asset.id,
    playbackId: signed.id,
    durationSeconds: Math.round(Number(asset.duration) || 0),
  });
});
