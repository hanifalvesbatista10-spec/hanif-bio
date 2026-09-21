import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { formatMoneyCents } from "../../services/checkoutApi";

const STATUS = {
  pending: { label: "Aguardando", tone: "draft" },
  paid: { label: "Pago", tone: "published" },
  failed: { label: "Falhou", tone: "draft" },
  canceled: { label: "Cancelado", tone: "draft" },
  refunded: { label: "Reembolsado", tone: "draft" },
};
const METHOD = { card: "Cartão", pix: "Pix", boleto: "Boleto" };

const maskCpf = (cpf) => {
  const digits = String(cpf || "").replace(/\D/g, "");
  return digits.length === 11 ? `•••.•••.•••-${digits.slice(9)}` : "—";
};

// Traduz o retorno de /api/checkout-diagnose em um texto que diz o que fazer.
function describeDiagnosis(d) {
  const lines = [];
  let ok = true;

  // Pix e cartão: InfinitePay (não usa chave, só a InfiniteTag)
  if (!d.variables.SUPABASE_SERVICE_ROLE_KEY) {
    ok = false;
    lines.push("Falta a variável SUPABASE_SERVICE_ROLE_KEY na Vercel.");
  }
  if (d.variables.INFINITEPAY_HANDLE) {
    lines.push(`Pix e cartão: InfinitePay configurada (InfiniteTag ${d.infinitepayHandle}).${d.variables.SITE_URL ? "" : " Sugestão: crie também a variável SITE_URL com o endereço do site."}`);
  } else {
    ok = false;
    lines.push("Pix e cartão: falta a variável INFINITEPAY_HANDLE na Vercel (a sua InfiniteTag, sem o $).");
  }

  // Boleto: Asaas (opcional; sem ele o boleto some da escolha do comprador só ao tentar)
  const env = d.envUsed === "sandbox" ? "testes (sandbox)" : "produção";
  if (!d.variables.ASAAS_API_KEY) {
    lines.push("Boleto: Asaas não configurado (faltam ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN). Sem isso o boleto não funciona.");
  } else if (d.asaas?.ok) {
    lines.push(`Boleto: conexão com o Asaas OK, no ambiente de ${env}.${d.envUsed === "production" ? " Atenção: aqui cobra de verdade." : ""}`);
  } else if (d.otherEnv?.ok) {
    ok = false;
    const other = d.otherEnv.env === "sandbox" ? "testes (sandbox)" : "produção";
    lines.push(`Boleto: a chave do Asaas é do ambiente de ${other}, mas o site usa o de ${env}. Crie a variável ASAAS_ENV com o valor ${d.otherEnv.env} e faça um redeploy.`);
  } else {
    ok = false;
    lines.push(`Boleto: o Asaas recusou a chave (ambiente de ${env}): ${d.asaas?.message || "sem detalhes"} (código ${d.asaas?.status}).`);
  }
  if (d.variables.ASAAS_API_KEY && !d.variables.ASAAS_WEBHOOK_TOKEN) {
    ok = false;
    lines.push("Boleto: falta a variável ASAAS_WEBHOOK_TOKEN (sem ela o pagamento do boleto não é confirmado).");
  }
  return { ok, text: lines.join(" ") };
}

const dateTime = (value) =>
  new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function isMissingTable(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("pgrst205") || text.includes("does not exist") || text.includes("schema cache");
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [busyId, setBusyId] = useState("");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*,product:products(title,slug)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      if (isMissingTable(error)) setMissing(true);
      else {
        setMessageType("error");
        setMessage(`Não foi possível carregar os pedidos: ${error.message}`);
      }
      setOrders([]);
    } else {
      setMissing(false);
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const paid = orders.filter((order) => order.status === "paid");
    return {
      paidCount: paid.length,
      revenue: paid.reduce((sum, order) => sum + order.amount_cents, 0),
      pending: orders.filter((order) => order.status === "pending").length,
      refunded: orders.filter((order) => order.status === "refunded").length,
    };
  }, [orders]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) return false;
      if (!term) return true;
      return [order.buyer_name, order.buyer_email, order.product?.title].some((field) => String(field || "").toLowerCase().includes(term));
    });
  }, [orders, filter, query]);

  const testConnection = async () => {
    setTesting(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/checkout-diagnose", { headers: { Authorization: `Bearer ${data?.session?.access_token || ""}` }, cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `Erro ${response.status}`);
      const result = describeDiagnosis(body);
      setMessageType(result.ok ? "success" : "error");
      setMessage(result.text);
    } catch (error) {
      setMessageType("error");
      setMessage(`Não foi possível testar: ${error.message}`);
    }
    setTesting(false);
  };

  // Estorno de Pix/cartão é feito no app da InfinitePay (que não avisa o site): aqui você registra e tira o acesso.
  const markRefunded = async (order) => {
    if (!window.confirm(`Marcar o pedido de ${order.buyer_name} como reembolsado e tirar o acesso a “${order.product?.title}”? Faça o estorno no app da InfinitePay (ou no Asaas) antes.`)) return;
    setBusyId(order.id);
    setMessage("");
    try {
      const { error } = await supabase.from("orders").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", order.id);
      if (error) throw error;
      if (order.user_id) {
        const { error: accessError } = await supabase.from("user_products").update({ access_status: "revoked" }).eq("user_id", order.user_id).eq("product_id", order.product_id);
        if (accessError) throw accessError;
      }
      setMessageType("success");
      setMessage(`Pedido de ${order.buyer_name} marcado como reembolsado${order.user_id ? " e acesso removido" : ""}.`);
      load();
    } catch (error) {
      setMessageType("error");
      setMessage(`Não foi possível registrar o reembolso: ${error.message}`);
    }
    setBusyId("");
  };

  const grantNow = async (order) => {
    setBusyId(order.id);
    setMessage("");
    try {
      let userId = order.user_id;
      if (!userId) {
        // mesmo e-mail do pedido, sem diferenciar maiúsculas ("\", "%" e "_" escapados para casar o e-mail exato)
        const exact = String(order.buyer_email || "").replace(/[\\%_]/g, "\\$&");
        const { data, error } = await supabase.from("profiles").select("id").ilike("email", exact).limit(2);
        if (error) throw error;
        if (!data || data.length !== 1) {
          setMessageType("error");
          setMessage(
            data && data.length > 1
              ? "Há mais de um perfil com esse e-mail. Libere manualmente em “Acessos dos alunos”."
              : `${order.buyer_name} ainda não criou conta com o e-mail ${order.buyer_email}. O acesso é liberado sozinho assim que ele criar a conta com esse e-mail.`
          );
          setBusyId("");
          return;
        }
        userId = data[0].id;
        const { error: linkError } = await supabase.from("orders").update({ user_id: userId }).eq("id", order.id);
        if (linkError) throw linkError;
      }
      const { error } = await supabase
        .from("user_products")
        .upsert({ user_id: userId, product_id: order.product_id, access_status: "active" }, { onConflict: "user_id,product_id" });
      if (error) throw error;
      setMessageType("success");
      setMessage(`Acesso a “${order.product?.title}” liberado para ${order.buyer_name}.`);
      load();
    } catch (error) {
      setMessageType("error");
      setMessage(`Não foi possível liberar: ${error.message}`);
    }
    setBusyId("");
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">
          O banco ainda não tem os pedidos. Execute <strong>supabase/19_checkout_proprio.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>VENDAS</span>
          <h2>Pedidos do checkout</h2>
        </div>
        <div className="cert-head-actions">
          <button type="button" className="admin-button" onClick={testConnection} disabled={testing}>{testing ? "Testando..." : "Testar conexão"}</button>
          <a className="admin-button" href="https://app.infinitepay.io/" target="_blank" rel="noreferrer">Abrir a InfinitePay ↗</a>
        </div>
      </div>

      <p className="adm-hint">
        Aqui aparecem as compras feitas no checkout do site. O acesso do aluno é liberado sozinho quando o pagamento é confirmado.
        Pix e cartão são pagos na InfinitePay; o boleto, no Asaas. Estornos de boleto (Asaas) tiram o acesso sozinhos. Estornos de Pix e cartão você faz no app da InfinitePay e depois usa “Marcar como reembolsado” aqui para tirar o acesso.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <div className="ord-stats">
        <div><strong>{formatMoneyCents(totals.revenue)}</strong><span>recebido ({totals.paidCount} pago{totals.paidCount === 1 ? "" : "s"})</span></div>
        <div><strong>{totals.pending}</strong><span>aguardando pagamento</span></div>
        <div><strong>{totals.refunded}</strong><span>reembolsado{totals.refunded === 1 ? "" : "s"}</span></div>
      </div>

      <div className="ord-toolbar">
        <div className="adm-segment" role="group" aria-label="Filtrar por status">
          {[["all", "Todos"], ["paid", "Pagos"], ["pending", "Aguardando"], ["failed", "Falharam"], ["refunded", "Reembolsados"]].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <input type="search" className="ord-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou produto…" aria-label="Buscar pedidos" />
      </div>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : shown.length === 0 ? (
        <div className="admin-empty">{orders.length === 0 ? "Nenhum pedido ainda. Ative o checkout do site em um produto para começar a vender aqui." : "Nenhum pedido neste filtro."}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Data</th><th>Comprador</th><th>Produto</th><th>Valor</th><th>Forma</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {shown.map((order) => {
                const status = STATUS[order.status] || { label: order.status, tone: "draft" };
                return (
                  <tr key={order.id}>
                    <td>{dateTime(order.created_at)}</td>
                    <td><strong>{order.buyer_name}</strong><small>{order.buyer_email}</small><small>CPF {maskCpf(order.buyer_cpf)}</small></td>
                    <td>{order.product?.title || "—"}</td>
                    <td>{formatMoneyCents(order.amount_cents)}</td>
                    <td>{METHOD[order.payment_method] || "—"}</td>
                    <td>
                      <span className={`status-badge ${status.tone}`}>{status.label}</span>
                      {order.status === "paid" && <small>{order.user_id ? "acesso liberado" : "sem conta ainda"}</small>}
                    </td>
                    <td>
                      {order.status === "paid" && (
                        <div className="table-actions">
                          <button type="button" onClick={() => grantNow(order)} disabled={busyId === order.id}>{busyId === order.id ? "..." : "Liberar acesso"}</button>
                          <button type="button" onClick={() => markRefunded(order)} disabled={busyId === order.id}>Marcar como reembolsado</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
