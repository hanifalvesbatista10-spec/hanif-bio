import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { formatMoneyCents } from "../../services/checkoutApi";
import RowActions from "../../components/admin/RowActions";
import "../../styles/forms-admin.css";
import "../../styles/product-links.css";

const CODE_RE = /^[A-Z0-9_-]{2,40}$/;
const STATUS_LABEL = { pending: "Pendente", active: "Ativo", rejected: "Recusado", blocked: "Bloqueado" };
const STATUS_TONE = { pending: "draft", active: "published", rejected: "draft", blocked: "draft" };

function isMissing(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("pgrst205") || text.includes("does not exist") || text.includes("schema cache");
}

// Código sugerido a partir do nome (a pessoa pode trocar): primeiro nome + "10".
function suggestCode(name) {
  const base = String(name || "").trim().split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return base ? `${base}10` : "";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AffiliatesPage() {
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [settings, setSettings] = useState({
    default_commission_percent: "10",
    signup_enabled: true,
    tier2_threshold: "5",
    tier2_percent: "15",
    tier3_threshold: "10",
    tier3_percent: "20",
    minimum_payout: "50",
    materials_url: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [approving, setApproving] = useState(null); // afiliado sendo aprovado
  const [approveForm, setApproveForm] = useState({ code: "", discount_type: "percent", discount_value: "10", commission_percent: "" });
  const [approveSaving, setApproveSaving] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = async () => {
    setLoading(true);
    const [affiliatesR, couponsR, commissionsR, settingsR] = await Promise.all([
      supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
      supabase.from("coupons").select("id,code,discount_type,discount_value,active,affiliate_id").not("affiliate_id", "is", null),
      supabase.from("affiliate_commissions").select("affiliate_id,amount_cents,status,created_at"),
      supabase.from("affiliate_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (affiliatesR.error) {
      if (isMissing(affiliatesR.error)) setMissing(true);
      else notify("error", `Não foi possível carregar os afiliados: ${affiliatesR.error.message}`);
    } else {
      setAffiliates(affiliatesR.data || []);
    }
    if (!couponsR.error) setCoupons(couponsR.data || []);
    if (!commissionsR.error) setCommissions(commissionsR.data || []);
    if (settingsR.data) {
      const d = settingsR.data;
      setSettings({
        default_commission_percent: String(d.default_commission_percent ?? "10"),
        signup_enabled: d.signup_enabled !== false,
        tier2_threshold: d.tier2_threshold === null || d.tier2_threshold === undefined ? "" : String(d.tier2_threshold),
        tier2_percent: String(d.tier2_percent ?? "15"),
        tier3_threshold: d.tier3_threshold === null || d.tier3_threshold === undefined ? "" : String(d.tier3_threshold),
        tier3_percent: String(d.tier3_percent ?? "20"),
        minimum_payout: String((d.minimum_payout_cents ?? 5000) / 100).replace(".", ","),
        materials_url: d.materials_url || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const couponByAffiliate = useMemo(() => Object.fromEntries(coupons.map((c) => [c.affiliate_id, c])), [coupons]);
  const totalsByAffiliate = useMemo(() => {
    const totals = {};
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    for (const row of commissions) {
      const t = totals[row.affiliate_id] || { owed: 0, paid: 0, salesThisMonth: 0 };
      if (row.status === "owed") t.owed += row.amount_cents;
      if (row.status === "paid") t.paid += row.amount_cents;
      if (row.status !== "void" && new Date(row.created_at) >= monthStart) t.salesThisMonth += 1;
      totals[row.affiliate_id] = t;
    }
    return totals;
  }, [commissions]);

  // Mesma lógica da faixa progressiva do servidor (api/_lib/orders.js), só pra mostrar na tela — quem
  // calcula de verdade, na hora da venda, é o servidor.
  const currentPercentFor = (affiliate) => {
    if (Number(affiliate.commission_percent) > 0) return { percent: Number(affiliate.commission_percent), fixed: true };
    const sales = totalsByAffiliate[affiliate.id]?.salesThisMonth || 0;
    const t3 = Number(settings.tier3_threshold);
    const t2 = Number(settings.tier2_threshold);
    if (settings.tier3_threshold && sales >= t3) return { percent: Number(settings.tier3_percent), fixed: false };
    if (settings.tier2_threshold && sales >= t2) return { percent: Number(settings.tier2_percent), fixed: false };
    return { percent: Number(settings.default_commission_percent), fixed: false };
  };

  const pending = affiliates.filter((a) => a.status === "pending");
  const others = affiliates.filter((a) => a.status !== "pending");

  const saveSettings = async (event) => {
    event.preventDefault();
    const percent = Number(String(settings.default_commission_percent).replace(",", "."));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return notify("error", "Informe uma comissão padrão entre 1 e 100.");

    const t2Raw = String(settings.tier2_threshold).trim();
    const t3Raw = String(settings.tier3_threshold).trim();
    const tier2_threshold = t2Raw === "" ? null : Number(t2Raw);
    const tier3_threshold = t3Raw === "" ? null : Number(t3Raw);
    const tier2_percent = Number(String(settings.tier2_percent).replace(",", "."));
    const tier3_percent = Number(String(settings.tier3_percent).replace(",", "."));
    if (tier2_threshold !== null && (!Number.isInteger(tier2_threshold) || tier2_threshold <= 0)) return notify("error", "A meta de vendas da 2ª faixa deve ser um número inteiro maior que zero (ou em branco para desativar).");
    if (tier3_threshold !== null && (!Number.isInteger(tier3_threshold) || tier3_threshold <= 0)) return notify("error", "A meta de vendas da 3ª faixa deve ser um número inteiro maior que zero (ou em branco para desativar).");
    if (tier2_threshold !== null && (!Number.isFinite(tier2_percent) || tier2_percent <= 0 || tier2_percent > 100)) return notify("error", "A comissão da 2ª faixa deve ser entre 1 e 100.");
    if (tier3_threshold !== null && (!Number.isFinite(tier3_percent) || tier3_percent <= 0 || tier3_percent > 100)) return notify("error", "A comissão da 3ª faixa deve ser entre 1 e 100.");
    if (tier2_threshold !== null && tier3_threshold !== null && tier3_threshold <= tier2_threshold) return notify("error", "A meta da 3ª faixa deve ser maior que a da 2ª faixa.");

    const minimumRaw = Number(String(settings.minimum_payout).replace(",", "."));
    if (!Number.isFinite(minimumRaw) || minimumRaw < 0) return notify("error", "Informe um valor mínimo de pagamento válido (pode ser 0).");
    const minimum_payout_cents = Math.round(minimumRaw * 100);

    const materials_url = settings.materials_url.trim();
    if (materials_url && !/^https?:\/\//i.test(materials_url)) return notify("error", "O link dos materiais deve começar com http:// ou https://.");

    setSavingSettings(true);
    const { error } = await supabase
      .from("affiliate_settings")
      .update({
        default_commission_percent: percent,
        signup_enabled: settings.signup_enabled,
        tier2_threshold,
        tier2_percent: tier2_threshold !== null ? tier2_percent : null,
        tier3_threshold,
        tier3_percent: tier3_threshold !== null ? tier3_percent : null,
        minimum_payout_cents,
        materials_url: materials_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSavingSettings(false);
    if (error) {
      if (isMissing(error)) return setMissing(true);
      return notify("error", `Não foi possível salvar: ${error.message}`);
    }
    notify("success", "Configuração salva.");
    load();
  };

  const startApprove = (affiliate) => {
    setApproving(affiliate);
    setApproveError("");
    setApproveForm({ code: suggestCode(affiliate.full_name), discount_type: "percent", discount_value: "10", commission_percent: "" });
  };

  const confirmApprove = async (event) => {
    event.preventDefault();
    const code = approveForm.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!CODE_RE.test(code)) return setApproveError("O código deve ter de 2 a 40 letras, números, “-” ou “_” (sem espaços nem acentos).");
    const raw = Number(String(approveForm.discount_value).replace(",", "."));
    let discount_value;
    if (approveForm.discount_type === "percent") {
      if (!Number.isFinite(raw) || raw < 1 || raw > 100 || !Number.isInteger(raw)) return setApproveError("A porcentagem de desconto deve ser um número inteiro de 1 a 100.");
      discount_value = raw;
    } else {
      if (!Number.isFinite(raw) || raw <= 0) return setApproveError("Informe o valor do desconto em reais (ex.: 50 ou 49,90).");
      discount_value = Math.round(raw * 100);
    }
    const commissionRaw = approveForm.commission_percent.trim();
    const commission_percent = commissionRaw === "" ? null : Number(commissionRaw.replace(",", "."));
    if (commission_percent !== null && (!Number.isFinite(commission_percent) || commission_percent <= 0 || commission_percent > 100)) {
      return setApproveError("A comissão deste afiliado (se preencher) deve ser entre 1 e 100.");
    }

    setApproveSaving(true);
    setApproveError("");
    const couponResult = await supabase
      .from("coupons")
      .insert({ code, discount_type: approveForm.discount_type, discount_value, affiliate_id: approving.id, active: true, one_per_customer: false })
      .select("id")
      .single();
    if (couponResult.error) {
      setApproveSaving(false);
      if (couponResult.error.code === "23505") return setApproveError(`Já existe um cupom com o código ${code}. Escolha outro.`);
      if (isMissing(couponResult.error)) { setMissing(true); return; }
      return setApproveError(`Não foi possível criar o cupom: ${couponResult.error.message}`);
    }
    const affiliateResult = await supabase
      .from("affiliates")
      .update({ status: "active", approved_at: new Date().toISOString(), commission_percent })
      .eq("id", approving.id);
    setApproveSaving(false);
    if (affiliateResult.error) return setApproveError(`O cupom foi criado, mas não consegui aprovar o afiliado: ${affiliateResult.error.message}`);

    notify("success", `${approving.full_name} aprovado. Código ${code} criado.`);
    setApproving(null);
    load();
  };

  const reject = async (affiliate) => {
    if (!window.confirm(`Recusar o pedido de ${affiliate.full_name}?`)) return;
    setBusyId(affiliate.id);
    const { error } = await supabase.from("affiliates").update({ status: "rejected" }).eq("id", affiliate.id);
    setBusyId(null);
    if (error) return notify("error", error.message);
    notify("success", `Pedido de ${affiliate.full_name} recusado.`);
    load();
  };

  const toggleBlock = async (affiliate) => {
    const next = affiliate.status === "blocked" ? "active" : "blocked";
    setBusyId(affiliate.id);
    const { error } = await supabase.from("affiliates").update({ status: next }).eq("id", affiliate.id);
    setBusyId(null);
    if (error) return notify("error", error.message);
    notify("success", next === "blocked" ? `${affiliate.full_name} bloqueado: o cupom dele para de valer.` : `${affiliate.full_name} reativado.`);
    load();
  };

  const markPaid = async (affiliate) => {
    const owed = totalsByAffiliate[affiliate.id]?.owed || 0;
    if (owed <= 0) return notify("error", "Não há comissão pendente para marcar como paga.");
    const minimumCents = Math.round(Number(String(settings.minimum_payout).replace(",", ".")) * 100) || 0;
    const belowMinimum = minimumCents > 0 && owed < minimumCents;
    const warning = belowMinimum ? `\n\nAviso: esse valor está abaixo do mínimo de pagamento configurado (${formatMoneyCents(minimumCents)}). Você pode pagar assim mesmo.` : "";
    if (!window.confirm(`Marcar ${formatMoneyCents(owed)} como pago para ${affiliate.full_name}? Faça o Pix antes.${warning}`)) return;
    setBusyId(affiliate.id);
    const { error } = await supabase
      .from("affiliate_commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("affiliate_id", affiliate.id)
      .eq("status", "owed");
    setBusyId(null);
    if (error) return notify("error", error.message);
    notify("success", `Comissão de ${affiliate.full_name} marcada como paga.`);
    load();
  };

  const saveCommission = async (affiliate, value) => {
    const trimmed = value.trim();
    const percent = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (percent !== null && (!Number.isFinite(percent) || percent <= 0 || percent > 100)) {
      notify("error", "A comissão deve ser entre 1 e 100 (ou em branco para usar o padrão).");
      load();
      return;
    }
    const { error } = await supabase.from("affiliates").update({ commission_percent: percent }).eq("id", affiliate.id);
    if (error) return notify("error", error.message);
    load();
  };

  const copyCode = async (affiliate) => {
    const coupon = couponByAffiliate[affiliate.id];
    if (!coupon) return;
    const ok = await copyText(coupon.code);
    setCopiedId(ok ? `code-${affiliate.id}` : "");
    if (ok) setTimeout(() => setCopiedId(""), 2200);
  };

  const copyWhatsapp = async (affiliate) => {
    const coupon = couponByAffiliate[affiliate.id];
    if (!coupon) return;
    const first = affiliate.full_name.trim().split(/\s+/)[0] || "";
    const link = `${window.location.origin}/`;
    const discount = coupon.discount_type === "percent" ? `${coupon.discount_value}% de desconto` : formatMoneyCents(coupon.discount_value) + " de desconto";
    const text = `Oi ${first}! Seu cadastro de afiliado foi aprovado. Seu código é ${coupon.code} (dá ${discount} pra quem comprar com ele). É só divulgar o link ${link} e pedir pra pessoa usar o código ${coupon.code} no checkout. Cada venda com o seu código gera comissão pra você.`;
    const ok = await copyText(text);
    setCopiedId(ok ? `zap-${affiliate.id}` : "");
    if (ok) setTimeout(() => setCopiedId(""), 2200);
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <span>VENDAS</span>
            <h2>Afiliados</h2>
          </div>
        </div>
        <div className="admin-alert error">
          O banco ainda não tem o sistema de afiliados. Execute <strong>supabase/34_afiliados.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>VENDAS</span>
          <h2>Afiliados</h2>
        </div>
      </div>

      <p className="adm-hint">
        Quem se candidata pelo formulário público entra como pendente. Ao aprovar, você cria um cupom exclusivo para essa pessoa: o
        desconto vai pra quem compra, e a comissão é calculada sozinha quando o pedido é pago. O pagamento da comissão é feito por
        você, por fora (Pix); aqui você só marca como pago.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <form className="pl-card" onSubmit={saveSettings} style={{ marginBottom: 24 }}>
        <h3>Configuração</h3>
        <div className="form-grid two" style={{ marginTop: 14 }}>
          <label>Comissão padrão (%)
            <input value={settings.default_commission_percent} onChange={(e) => setSettings((c) => ({ ...c, default_commission_percent: e.target.value }))} inputMode="decimal" placeholder="10" />
          </label>
        </div>

        <p className="adm-hint" style={{ marginTop: 18 }}>
          Comissão progressiva: a taxa sobe sozinha conforme as vendas pagas do afiliado no mês corrente (reinicia todo dia 1). Vale
          só da venda que bate a meta em diante. Deixe a meta em branco para desativar uma faixa. Não vale para afiliado com comissão
          própria definida (isso é configurado por afiliado, na tabela abaixo).
        </p>
        <div className="form-grid two" style={{ marginTop: 10 }}>
          <label>2ª faixa — a partir de quantas vendas no mês
            <input value={settings.tier2_threshold} onChange={(e) => setSettings((c) => ({ ...c, tier2_threshold: e.target.value }))} inputMode="numeric" placeholder="5" />
          </label>
          <label>2ª faixa — comissão (%)
            <input value={settings.tier2_percent} onChange={(e) => setSettings((c) => ({ ...c, tier2_percent: e.target.value }))} inputMode="decimal" placeholder="15" />
          </label>
          <label>3ª faixa — a partir de quantas vendas no mês
            <input value={settings.tier3_threshold} onChange={(e) => setSettings((c) => ({ ...c, tier3_threshold: e.target.value }))} inputMode="numeric" placeholder="10" />
          </label>
          <label>3ª faixa — comissão (%)
            <input value={settings.tier3_percent} onChange={(e) => setSettings((c) => ({ ...c, tier3_percent: e.target.value }))} inputMode="decimal" placeholder="20" />
          </label>
        </div>

        <div className="form-grid two" style={{ marginTop: 18 }}>
          <label>Valor mínimo para pagamento (R$)
            <input value={settings.minimum_payout} onChange={(e) => setSettings((c) => ({ ...c, minimum_payout: e.target.value }))} inputMode="decimal" placeholder="50" />
          </label>
          <label>Link dos materiais de divulgação
            <input value={settings.materials_url} onChange={(e) => setSettings((c) => ({ ...c, materials_url: e.target.value }))} type="url" placeholder="https://..." />
          </label>
        </div>
        <p className="adm-hint">O valor mínimo é só um aviso na hora de marcar como pago — não impede pagar abaixo dele.</p>

        <label className="adm-check-row" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={settings.signup_enabled} onChange={(e) => setSettings((c) => ({ ...c, signup_enabled: e.target.checked }))} />
          Aceitar novos pedidos de afiliados (formulário público em /seja-afiliado)
        </label>
        <button className="admin-button primary" type="submit" disabled={savingSettings} style={{ marginTop: 16 }}>
          {savingSettings ? "Salvando..." : "Salvar"}
        </button>
      </form>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : (
        <>
          <h3 style={{ margin: "0 0 12px" }}>Pedidos pendentes {pending.length > 0 && `(${pending.length})`}</h3>
          {pending.length === 0 ? (
            <div className="admin-empty" style={{ marginBottom: 28 }}>Nenhum pedido pendente.</div>
          ) : (
            <div className="admin-table-wrap" style={{ marginBottom: 28 }}>
              <table className="admin-table">
                <thead>
                  <tr><th>Quem</th><th>WhatsApp</th><th>Mensagem</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {pending.map((affiliate) => (
                    <tr key={affiliate.id}>
                      <td><strong>{affiliate.full_name}</strong><small>{affiliate.email}</small></td>
                      <td>{affiliate.phone || "—"}</td>
                      <td style={{ maxWidth: 260 }}>{affiliate.notes || "—"}</td>
                      <td>
                        <RowActions
                          label={`Ações do pedido de ${affiliate.full_name}`}
                          primary={{ label: "Aprovar", onClick: () => startApprove(affiliate) }}
                          items={[{ label: "Recusar", danger: true, disabled: busyId === affiliate.id, onClick: () => reject(affiliate) }]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {approving && (
            <form className="pl-card" onSubmit={confirmApprove} style={{ marginBottom: 28 }}>
              <h3>Aprovar {approving.full_name}</h3>
              <p className="pl-intro">Cria o cupom exclusivo desta pessoa. Ela recebe o desconto configurado, e a comissão é calculada quando o pedido é pago.</p>
              <div className="form-grid two" style={{ marginTop: 4 }}>
                <label>Código do cupom
                  <input value={approveForm.code} onChange={(e) => setApproveForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} maxLength={40} />
                </label>
                <label>Tipo de desconto
                  <select value={approveForm.discount_type} onChange={(e) => setApproveForm((c) => ({ ...c, discount_type: e.target.value }))}>
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </label>
                <label>{approveForm.discount_type === "percent" ? "Porcentagem de desconto" : "Valor do desconto (R$)"}
                  <input value={approveForm.discount_value} onChange={(e) => setApproveForm((c) => ({ ...c, discount_value: e.target.value }))} inputMode="decimal" />
                </label>
                <label>Comissão desta pessoa (opcional)
                  <input value={approveForm.commission_percent} onChange={(e) => setApproveForm((c) => ({ ...c, commission_percent: e.target.value }))} inputMode="decimal" placeholder={`Em branco = padrão (${settings.default_commission_percent}%)`} />
                </label>
              </div>
              {approveError && <div className="admin-alert error" style={{ marginTop: 14 }}>{approveError}</div>}
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button className="admin-button primary" type="submit" disabled={approveSaving}>{approveSaving ? "Aprovando..." : "Confirmar aprovação"}</button>
                <button className="admin-button adm-ghost" type="button" onClick={() => setApproving(null)} disabled={approveSaving}>Cancelar</button>
              </div>
            </form>
          )}

          <h3 style={{ margin: "0 0 12px" }}>Afiliados</h3>
          {others.length === 0 ? (
            <div className="admin-empty">Nenhum afiliado aprovado, recusado ou bloqueado ainda.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Quem</th><th>Código</th><th>Comissão</th><th>A pagar</th><th>Já pago</th><th>Status</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {others.map((affiliate) => {
                    const coupon = couponByAffiliate[affiliate.id];
                    const totals = totalsByAffiliate[affiliate.id] || { owed: 0, paid: 0, salesThisMonth: 0 };
                    const current = currentPercentFor(affiliate);
                    return (
                      <tr key={affiliate.id}>
                        <td><strong>{affiliate.full_name}</strong><small>{affiliate.email}</small></td>
                        <td>{coupon ? coupon.code : "—"}</td>
                        <td>
                          <input
                            className="pl-url"
                            style={{ width: 80, textAlign: "center" }}
                            defaultValue={affiliate.commission_percent ?? ""}
                            placeholder={`${settings.default_commission_percent}%`}
                            onBlur={(e) => saveCommission(affiliate, e.target.value)}
                            aria-label={`Comissão de ${affiliate.full_name}`}
                          />
                          {!current.fixed && affiliate.status === "active" && (
                            <small style={{ display: "block", marginTop: 4 }}>
                              Taxa atual: {current.percent}% ({totals.salesThisMonth} venda{totals.salesThisMonth === 1 ? "" : "s"} no mês)
                            </small>
                          )}
                        </td>
                        <td>{formatMoneyCents(totals.owed)}</td>
                        <td>{formatMoneyCents(totals.paid)}</td>
                        <td><span className={`status-badge ${STATUS_TONE[affiliate.status]}`}>{STATUS_LABEL[affiliate.status] || affiliate.status}</span></td>
                        <td>
                          <RowActions
                            label={`Ações de ${affiliate.full_name}`}
                            items={[
                              { label: copiedId === `code-${affiliate.id}` ? "Copiado" : "Copiar código", hidden: !coupon, onClick: () => copyCode(affiliate) },
                              { label: copiedId === `zap-${affiliate.id}` ? "Copiado" : "Copiar mensagem de WhatsApp", hidden: !coupon, onClick: () => copyWhatsapp(affiliate) },
                              { label: "Marcar comissão como paga", hidden: totals.owed <= 0, disabled: busyId === affiliate.id, onClick: () => markPaid(affiliate) },
                              { label: affiliate.status === "blocked" ? "Reativar" : "Bloquear", danger: affiliate.status !== "blocked", disabled: busyId === affiliate.id, onClick: () => toggleBlock(affiliate) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
