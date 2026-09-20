// Dados do aluno usados em certificados e carteirinhas (CPF, RG, tipo sanguíneo, foto).
import { supabase } from "./supabase";

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const PHOTO_BUCKET = "student-photos";

export function formatCpf(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Confere os dois dígitos verificadores (evita CPF digitado errado).
export function isValidCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

// A migration 18 ainda não foi executada?
export function isMissingStudentColumns(error) {
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (error?.code === "PGRST204" || error?.code === "42703" || text.includes("column")) && /cpf|rg|blood_type/.test(text);
}

function loadFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem. Use JPG, PNG ou WebP."));
    };
    image.src = url;
  });
}

// Recorta no centro em 3:4 (formato de foto de documento) e reduz para no máximo 900x1200.
// Uma foto assim fica em ~100–200 KB, o que mantém o armazenamento pequeno.
export async function preparePhoto(file) {
  const { image, url } = await loadFile(file);
  try {
    const ratio = 3 / 4;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (sw / sh > ratio) sw = sh * ratio;
    else sh = sw / ratio;
    const sx = (image.naturalWidth - sw) / 2;
    const sy = Math.max(0, (image.naturalHeight - sh) * 0.25); // mantém o rosto (mais para cima)
    const outW = Math.min(900, Math.round(sw));
    const outH = Math.round(outW / ratio);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error("Não foi possível preparar a foto.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadStudentPhoto(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { cacheControl: "31536000", upsert: false, contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Apaga a foto antiga do bucket (se for uma foto enviada por aqui).
export async function removeStudentPhoto(url) {
  const marker = `/${PHOTO_BUCKET}/`;
  const index = String(url || "").indexOf(marker);
  if (index < 0) return;
  const path = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  await supabase.storage.from(PHOTO_BUCKET).remove([path]).catch(() => null);
}
