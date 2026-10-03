import { useMemo, useState } from "react";
import { markCommissionsPaid } from "../../../services/financeApi";
import { formatMoneyCents } from "../../../services/checkoutApi";

const inRange = (value, { from, to }) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= from.getTime() && time < to.getTime();
};

export default function CommissionsTab({ owedCommissions, commissions, affiliates, minimumPayoutCents, range, onChanged }) {
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const rows = useMemo(() => {
    const byId = Object.fromEntries(affiliates.map((a) => [a.id, a]));
    const map = new Map();
    const entry = (id) => {
      if (!map.has(id)) map.set(id, { id, affiliate: byId[id] || null, owed: 0, owedIds: [], oldest: null, paidInPeriod: 0 });
      return map.get(id);
    };
    for (const c of owedCommissions) {
      const e = entry(c.affiliate_id);
      e.owed += c.amount_cents;
      e.owedIds.push(c.id);
      if (!e.oldest || c.created_at < e.oldest) e.oldest = c.created_at;
    }
    for (const c of commissions) {
      if (c.status === "paid" && inRange(c.paid_at, range)) entry(c.affiliate_id).paidInPeriod += c.amount_cents;
    }
    return [...map.values()].sort((a, b) => b.owed - a.owed || b.paidInPeriod - a.paidInPeriod);
  }, [owedCommissions, commissions, affiliates, range]);

  const totalOwed = rows.reduce((total, row) => total + row.owed, 0);
  const totalPaid = rows.reduce((total, row) => total + row.paidInPeriod, 0);
  const ready = rows.filter((row) => row.owed > 0 && row.owed >= minimumPayoutCents);

  const markPaid = async (row) => {
    const name = row.affiliate?.full_name || "este afiliado";
    const below = minimumPayoutCents > 0 && row.owed < minimumPayoutCents;
    const warning = below ? `\n\nAviso: esse valor está abaixo do mínimo de pagamento (${formatMoneyCents(minimumPayoutCents)}). Você pode pagar assim mesmo.` : "";
    if (!window.confirm(`Marcar ${formatMoneyCents(row.owed)} como pago para ${name}? Faça o Pix antes.${warning}`)) return;
    setBusyId(row.id);
    const { data, error } = await markCommissionsPaid(row.owedIds);
    setBusyId("");
    if (error) return notify("error", `Não foi possível marcar como paga: ${error.message}`);
    notify("success", `${(data || []).length} comissão(ões) de ${name} marcada(s) como paga(s).`);
    onChanged();
  };

  return (
    <div className="fin-commissions">
      <p className="adm-hint">
        Aqui você vê quanto deve a cada afiliado e marca o repasse depois de fazer o Pix. A comissão já entra como <strong>custo no dia da venda</strong> (no Resumo),
        então marcar como paga não muda o lucro: só tira o valor da lista de pendências. Para cadastrar afiliados e definir o percentual, use a aba Afiliados.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <div className="ord-stats">
        <div><strong>{formatMoneyCents(totalOwed)}</strong><span>a pagar a afiliados (total)</span></div>
        <div><strong>{ready.length}</strong><span>afiliado{ready.length === 1 ? "" : "s"} com saldo no mínimo{minimumPayoutCents ? ` (${formatMoneyCents(minimumPayoutCents)})` : ""}</span></div>
        <div><strong>{formatMoneyCents(totalPaid)}</strong><span>pago no período</span></div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-empty">Nenhuma comissão de afiliado ainda. Elas aparecem aqui quando alguém comprar com o cupom de um afiliado.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Afiliado</th><th>A pagar</th><th>Mais antiga</th><th>Pago no período</th><th>Chave Pix</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.affiliate?.full_name || "Afiliado removido"}</strong>
                    {row.affiliate?.status === "blocked" && <small>bloqueado</small>}
                    {row.owed > 0 && row.owed >= minimumPayoutCents && <small className="fin-ready">saldo pronto para pagar</small>}
                  </td>
                  <td>{formatMoneyCents(row.owed)}</td>
                  <td>{row.oldest ? new Date(row.oldest).toLocaleDateString("pt-BR") : "—"}</td>
                  <td>{formatMoneyCents(row.paidInPeriod)}</td>
                  <td>{row.affiliate?.pix_key || "—"}</td>
                  <td>
                    <button type="button" className="admin-button" disabled={row.owed <= 0 || busyId === row.id} onClick={() => markPaid(row)}>
                      {busyId === row.id ? "Salvando..." : "Marcar como paga"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
