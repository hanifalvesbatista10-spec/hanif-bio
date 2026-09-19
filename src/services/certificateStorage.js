import { supabase } from "./supabase";

const BUCKET = "certificate-backgrounds";

// Envia uma imagem (foto de participante, assinatura...) ao bucket público dos certificados.
export async function uploadCertificateImage(file, folder = "photos") {
  const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
