// Depoimentos por link: endereço, mensagem pronta para WhatsApp e envio da foto do aluno.
import { supabase } from "./supabase";

export const FEEDBACK_BUCKET = "feedback-photos";

export const feedbackLinkUrl = (token) => `${window.location.origin}/depoimento/${token}`;

export function feedbackMessage({ name, product, url }) {
  const first = String(name || "").trim().split(/\s+/)[0];
  const about = product ? `sobre ${product}` : "sobre a sua experiência";
  return `${first ? `Oi, ${first}!` : "Oi!"} Você pode deixar um depoimento ${about}? Leva uns 2 minutos e ajuda muito outras pessoas a conhecerem o trabalho. Só abrir o link e preencher:\n${url}`;
}

export const whatsappShareUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function linkState(link) {
  if (!link.active) return { key: "off", label: "Desligado", tone: "is-draft" };
  if (link.expires_at && new Date(link.expires_at) < new Date()) return { key: "expired", label: "Vencido", tone: "is-bad" };
  if (link.max_uses && link.uses >= link.max_uses) return { key: "used", label: "Já usado", tone: "is-draft" };
  return { key: "on", label: "Ativo", tone: "is-published" };
}

// A foto vai para uma pasta com o código do link; o banco só aceita se o link estiver ativo.
export async function uploadFeedbackPhoto(token, blob) {
  const path = `pending/${token}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(FEEDBACK_BUCKET).upload(path, blob, { cacheControl: "31536000", upsert: false, contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(FEEDBACK_BUCKET).getPublicUrl(path).data.publicUrl;
}

export const LINK_PROBLEMS = {
  not_found: { title: "Link não encontrado", text: "Confira se o endereço está completo ou peça um novo link para quem enviou." },
  inactive: { title: "Este link foi desligado", text: "Peça um novo link para quem enviou." },
  expired: { title: "Este link venceu", text: "Peça um novo link para quem enviou." },
  used: { title: "Este link já foi usado", text: "Se você ainda quer deixar o seu depoimento, peça um novo link para quem enviou." },
};
