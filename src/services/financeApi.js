// Leitura e gravação da aba Financeiro. As tabelas só respondem ao administrador (RLS em supabase/50).
import { supabase } from "./supabase";

const DAY = 24 * 60 * 60 * 1000;

export function isMissingFinanceTable(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("pgrst205") || text.includes("does not exist") || text.includes("schema cache");
}

// Carrega tudo o que o painel precisa desde "since". Receita e reembolso são filtrados pela data do pagamento/reembolso.
export async function loadFinanceData(since) {
  const sinceIso = since.toISOString();
  const pendingSince = new Date(Date.now() - 30 * DAY).toISOString();

  const [orders, pending, commissions, owed, affiliates, affiliateSettings, entries, settings] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,amount_cents,discount_cents,bump_cents,payment_method,coupon_code,paid_at,refunded_at,created_at,buyer_name,product:products(title)")
      .or(`paid_at.gte.${sinceIso},refunded_at.gte.${sinceIso}`)
      .order("paid_at", { ascending: false })
      .limit(5000),
    supabase.from("orders").select("id,amount_cents,payment_method,created_at").eq("status", "pending").gte("created_at", pendingSince).limit(1000),
    // comissões geradas (custo) ou pagas (histórico) desde "since"
    supabase.from("affiliate_commissions").select("id,affiliate_id,status,amount_cents,created_at,paid_at").or(`created_at.gte.${sinceIso},paid_at.gte.${sinceIso}`).limit(5000),
    // tudo o que ainda se deve aos afiliados, de qualquer data
    supabase.from("affiliate_commissions").select("id,affiliate_id,amount_cents,created_at").eq("status", "owed").limit(5000),
    supabase.from("affiliates").select("id,full_name,pix_key,status").limit(2000),
    supabase.from("affiliate_settings").select("minimum_payout_cents").eq("id", 1).maybeSingle(),
    supabase.from("finance_entries").select("*").order("occurred_on", { ascending: false }).limit(2000),
    supabase.from("finance_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const failed = [orders, pending, commissions, owed, affiliates, affiliateSettings, entries, settings].find((result) => result.error);
  if (failed) return { error: failed.error };

  return {
    orders: orders.data || [],
    pending: pending.data || [],
    commissions: commissions.data || [],
    owedCommissions: owed.data || [],
    affiliates: affiliates.data || [],
    minimumPayoutCents: affiliateSettings.data?.minimum_payout_cents || 0,
    entries: entries.data || [],
    settings: settings.data || null,
    truncated: (orders.data || []).length >= 5000,
  };
}

export const saveFinanceSettings = (values) =>
  supabase.from("finance_settings").upsert({ ...values, id: 1, updated_at: new Date().toISOString() }, { onConflict: "id" });

export const insertFinanceEntry = (entry) => supabase.from("finance_entries").insert(entry);
export const updateFinanceEntry = (id, entry) => supabase.from("finance_entries").update(entry).eq("id", id);
export const deleteFinanceEntry = (id) => supabase.from("finance_entries").delete().eq("id", id);

// Marca como pagas exatamente as comissões que o dono viu na tela (ids), e só as que ainda estão "a pagar".
export const markCommissionsPaid = (ids) =>
  supabase
    .from("affiliate_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "owed")
    .select("id");
