// Captação de leads do Radar de Evidências. O visitante só consegue INSERIR (regra do banco, supabase/48); quem lê a
// lista é o administrador. A "liberação" da análise é guardada neste navegador para não pedir os dados de novo.
import { supabase } from "./supabase";

const STORAGE_KEY = "ha_radar_lead_v1";

// WhatsApp brasileiro: só dígitos; com DDD (10 ou 11 dígitos) ganha o 55.
export function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export const isValidWhatsapp = (value) => /^\d{12,13}$/.test(normalizeWhatsapp(value));
export const isValidEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim()) && String(value).length <= 254;

export function getStoredLead() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return raw && raw.name && raw.email ? raw : null;
  } catch {
    return null;
  }
}

function storeLead(lead) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
  } catch {
    // navegador sem armazenamento (modo privado): a pessoa só terá de preencher de novo na próxima visita
  }
}

// Devolve { ok: true } quando o lead foi salvo OU já existia (mesmo e-mail), e { ok: false, message } nos demais casos.
export async function saveRadarLead({ name, email, whatsapp, itemId }) {
  const lead = { name: String(name).trim(), email: String(email).trim().toLowerCase(), whatsapp: normalizeWhatsapp(whatsapp) };
  const { error } = await supabase.from("radar_leads").insert({ ...lead, source: "radar", radar_item_id: itemId || null });
  // 23505 = e-mail já cadastrado: a pessoa já é lead, então só liberamos a leitura
  if (error && error.code !== "23505") {
    return { ok: false, message: "Não foi possível salvar agora. Confira os dados e tente de novo em instantes." };
  }
  storeLead(lead);
  return { ok: true };
}
