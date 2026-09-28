import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { formatMoneyCents } from "../../services/checkoutApi";
import "../../styles/forms-admin.css";
import "../../styles/product-links.css";

const STATUS_LABEL = { pending: "Abandonado", failed: "Pagamento recusado" };
const STAGE_LABEL = { 0: "Nenhum lembrete", 1: "1º lembrete enviado", 2: "Último lembrete enviado" };

function isMissing(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("pgrst205") || text.includes("does not exist") || text.includes("schema cache");
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "há poucos minutos";
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)} dia(s)`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function SalesRecoveryPage() {
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ enabled: false, coupon_code: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [copiedId, setCopiedId] = useState("");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = async () => {
    setLoading(true);
    const [ordersResult, settingsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,status,buyer_name,buyer_email,buyer_phone,amount_cents,created_at,recovery_stage,recovery_last_sent_at,recovery_opt_out,product:products(title,slug)")
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("recovery_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (ordersResult.error) {
      if (isMissing(ordersResult.error)) setMissing(true);
      else notify("error", `Não foi possível carregar os pedidos: ${ordersResult.error.message}`);
    } else {
      setOrders(ordersResult.data || []);
    }
    if (settingsResult.error) {
      if (isMissing(settingsResult.error)) setMissing(true);
    } else if (settingsResult.data) {
      setSettings({ enabled: settingsResult.data.enabled, coupon_code: settingsResult.data.coupon_code || "" });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const pending = orders.filter((order) => order.status === "pending").length;
    const failed = orders.filter((order) => order.status === "failed").length;
    const total = orders.reduce((sum, order) => sum + (order.amount_cents || 0), 0);
    return { pending, failed, total };
  }, [orders]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    const code = settings.coupon_code.trim().toUpperCase().replace(/\s+/g, "") || null;
    const { error } = await supabase
      .from("recovery_settings")
      .update({ enabled: settings.enabled, coupon_code: code, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      notify("error", isMissing(error) ? "" : `Não foi possível salvar: ${error.message}`);
      if (isMissing(error)) setMissing(true);
      return;
    }
    setSettings((current) => ({ ...current, coupon_code: code || "" }));
    notify("success", settings.enabled ? "Recuperação automática ligada. Os e-mails passam a sair no próximo horário do robô." : "Recuperação automática desligada.");
  };

  const whatsappMessage = (order) => {
    const first = String(order.buyer_name || "").trim().split(/\s+/)[0] || "";
    const link = `${window.location.origin}/checkout/${order.product?.slug || ""}${settings.coupon_code ? `?cupom=${settings.coupon_code}` : ""}`;
    const base = order.status === "failed"
      ? `Oi${first ? " " + first : ""}! Vi aqui que o pagamento de ${order.product?.title || "sua compra"} não foi aprovado. Quer tentar de novo? Fica bem rápido: ${link}`
      : `Oi${first ? " " + first : ""}! Vi que você começou a garantir ${order.product?.title || "sua vaga"} mas não finalizou. Posso te ajudar a concluir? ${link}`;
    return base;
  };

  const copyWhatsapp = async (order) => {
    const ok = await copyText(whatsappMessage(order));
    setCopiedId(ok ? order.id : "");
    if (ok) setTimeout(() => setCopiedId(""), 2200);
    else notify("error", "Não foi possível copiar. Copie a mensagem manualmente.");
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <span>VENDAS</span>
            <h2>Recuperação de vendas</h2>
          </div>
        </div>
        <div className="admin-alert error">
          O banco ainda não tem a recuperação de vendas. Execute <strong>supabase/29_recuperacao_de_vendas.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>VENDAS</span>
          <h2>Recuperação de vendas</h2>
        </div>
      </div>

      <p className="adm-hint">
        Quem começa a comprar e não termina (ou tem o cartão recusado) fica nesta lista. Com os e-mails automáticos ligados, o site manda
        até dois lembretes sozinho, sem passar de quem já pagou. Aqui embaixo você também pode mandar uma mensagem de WhatsApp pronta,
        com o link de pagamento, para quem deixou o telefone.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <form className="pl-card" onSubmit={saveSettings} style={{ marginBottom: 24 }}>
        <h3>Lembretes automáticos por e-mail</h3>
        <p className="pl-intro">
          Manda 1 e-mail pouco depois do abandono (ou do pagamento recusado) e, se ainda não pagou, 1 último lembrete no dia seguinte.
          Nunca manda para quem já pagou. Exige as variáveis <code>RESEND_API_KEY</code>, <code>RESEND_FROM</code> e <code>SITE_URL</code> na Vercel
          — veja docs/checkout.md.
        </p>
        <label className="adm-check-row" style={{ marginTop: 4 }}>
          <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} />
          Ligar os e-mails automáticos de recuperação
        </label>
        <div className="pl-coupon" style={{ marginTop: 14 }}>
          <label htmlFor="recovery-coupon">Cupom para oferecer no lembrete (opcional)</label>
          <input
            id="recovery-coupon"
            value={settings.coupon_code}
            onChange={(event) => setSettings((current) => ({ ...current, coupon_code: event.target.value.toUpperCase() }))}
            placeholder="Ex.: VOLTA10"
            autoComplete="off"
            spellCheck={false}
          />
          <small className="adm-hint">O cupom precisa existir em Cupons. Ele entra pronto no link do e-mail e da mensagem de WhatsApp.</small>
        </div>
        <button className="admin-button primary" type="submit" disabled={saving} style={{ marginTop: 16 }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <div className="fa-stats" style={{ marginBottom: 18 }}>
        <div className="fa-stat"><strong>{stats.pending}</strong><span>carrinhos abandonados</span></div>
        <div className="fa-stat"><strong>{stats.failed}</strong><span>pagamentos recusados</span></div>
        <div className="fa-stat"><strong>{formatMoneyCents(stats.total)}</strong><span>em vendas por recuperar</span></div>
      </div>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : orders.length === 0 ? (
        <div className="admin-empty">Nenhum carrinho abandonado ou pagamento recusado no momento. 🎉</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quem</th>
                <th>Produto</th>
                <th>Valor</th>
                <th>Situação</th>
                <th>Lembretes</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.buyer_name || "Sem nome"}</strong>
                    <small>{order.buyer_email}</small>
                  </td>
                  <td>{order.product?.title || "—"}</td>
                  <td>{formatMoneyCents(order.amount_cents)}</td>
                  <td>
                    <span className={`status-badge ${order.status === "failed" ? "draft" : ""}`}>{STATUS_LABEL[order.status] || order.status}</span>
                    <small style={{ display: "block", color: "#7b8c9c" }}>{timeAgo(order.created_at)}</small>
                  </td>
                  <td>
                    {order.recovery_opt_out ? "Pediu para não receber" : STAGE_LABEL[order.recovery_stage] || "—"}
                  </td>
                  <td>
                    <button type="button" className="pl-btn" disabled={!order.buyer_phone} onClick={() => copyWhatsapp(order)}>
                      {copiedId === order.id ? "Copiado" : "Copiar mensagem de WhatsApp"}
                    </button>
                    {!order.buyer_phone && <small style={{ display: "block", color: "#7b8c9c", marginTop: 4 }}>Sem WhatsApp cadastrado</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
