import { supabase } from "./supabase";

// Link de convite de grupo do WhatsApp (SQL 60). Mesma regra da tabela product_group_links.
const GROUP_URL = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}(\?\S*)?$/i;

export const isWhatsappGroupUrl = (value) => GROUP_URL.test(String(value || "").trim());

// Links dos cursos que o aluno tem liberados (a regra do banco só devolve os dele): { [productId]: url }.
// Sem a migration (ou sem acesso), devolve vazio e a tela segue sem o cartão.
export async function fetchMyGroupLinks(productIds = null) {
  let query = supabase.from("product_group_links").select("product_id,whatsapp_group_url");
  if (productIds?.length) query = query.in("product_id", productIds);
  const { data, error } = await query;
  if (error) return {};
  return Object.fromEntries((data || []).map((row) => [row.product_id, row.whatsapp_group_url]));
}

// Painel: link atual de um curso. available=false quando o SQL 60 ainda não foi executado.
export async function fetchGroupLink(productId) {
  const { data, error } = await supabase.from("product_group_links").select("whatsapp_group_url").eq("product_id", productId).maybeSingle();
  if (error) return { available: false, url: "" };
  return { available: true, url: data?.whatsapp_group_url || "" };
}

// Painel: grava (ou apaga, se vazio) o link do grupo de um curso.
export async function saveGroupLink(productId, url) {
  const value = String(url || "").trim();
  if (!value) {
    const { error } = await supabase.from("product_group_links").delete().eq("product_id", productId);
    return error;
  }
  if (!isWhatsappGroupUrl(value)) return new Error("O link do grupo precisa ser um convite do WhatsApp, no formato https://chat.whatsapp.com/...");
  const { error } = await supabase
    .from("product_group_links")
    .upsert({ product_id: productId, whatsapp_group_url: value, updated_at: new Date().toISOString() }, { onConflict: "product_id" });
  return error;
}
