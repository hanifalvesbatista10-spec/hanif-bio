// Cliente do Cloudflare R2 (compatível com S3) para os arquivos de produto (e-book) e de aula
// (material). As chaves nunca vão para o navegador — só o link temporário já assinado.
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HttpError } from "./mux.js";

const LINK_TTL_SECONDS = 300;

function r2Env() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET_NAME || "",
  };
}

export function requireR2Config() {
  const env = r2Env();
  const names = {
    accountId: "R2_ACCOUNT_ID",
    accessKeyId: "R2_ACCESS_KEY_ID",
    secretAccessKey: "R2_SECRET_ACCESS_KEY",
    bucket: "R2_BUCKET_NAME",
  };
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => names[key]);
  if (missing.length) {
    throw new HttpError(503, "r2_not_configured", `Armazenamento de arquivos ainda não configurado (faltam: ${missing.join(", ")}).`);
  }
  return env;
}

function r2Client() {
  const { accountId, accessKeyId, secretAccessKey } = requireR2Config();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// Link temporário de envio: o admin sobe o arquivo direto pro R2 (não passa pelo nosso servidor,
// que tem limite de tamanho de corpo bem menor que os 50 MB permitidos para um PDF).
export async function presignUpload(key, contentType) {
  const { bucket } = requireR2Config();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(r2Client(), command, { expiresIn: LINK_TTL_SECONDS });
}

// Link temporário de download: expira em poucos minutos, então não adianta copiar e repassar.
export async function presignDownload(key, filename) {
  const { bucket } = requireR2Config();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(filename ? { ResponseContentDisposition: `attachment; filename="${String(filename).replace(/"/g, "")}"` } : {}),
  });
  return getSignedUrl(r2Client(), command, { expiresIn: LINK_TTL_SECONDS });
}
