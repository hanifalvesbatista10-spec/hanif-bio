import { formatMoneyCents } from "../../../services/checkoutApi";

const METHOD = { card: "Cartão", pix: "Pix", boleto: "Boleto" };

function Block({ title, empty, children }) {
  return (
    <section className="fin-block">
      <h3>{title}</h3>
      {empty ? <p className="adm-hint">{empty}</p> : <div className="admin-table-wrap">{children}</div>}
    </section>
  );
}

export default function SalesTab({ summary: s, pending }) {
  const pendingByMethod = pending.reduce((acc, order) => {
    const key = order.payment_method || "—";
    acc[key] = acc[key] || { count: 0, cents: 0 };
    acc[key].count += 1;
    acc[key].cents += order.amount_cents || 0;
    return acc;
  }, {});

  return (
    <div className="fin-sales">
      <div className="ord-stats">
        <div><strong>{formatMoneyCents(s.gross)}</strong><span>faturamento bruto</span></div>
        <div><strong>{s.paidCount}</strong><span>vendas pagas</span></div>
        <div><strong>{formatMoneyCents(s.ticket)}</strong><span>ticket médio</span></div>
        <div><strong>{formatMoneyCents(s.refunds)}</strong><span>reembolsado ({s.refundCount})</span></div>
      </div>

      <Block title="Por produto" empty={s.byProduct.length === 0 ? "Nenhuma venda paga neste período." : ""}>
        <table className="admin-table">
          <thead><tr><th>Produto</th><th>Vendas</th><th>Faturamento</th><th>% do total</th></tr></thead>
          <tbody>
            {s.byProduct.map((row) => (
              <tr key={row.name}>
                <td><strong>{row.name}</strong></td>
                <td>{row.count}</td>
                <td>{formatMoneyCents(row.cents)}</td>
                <td>{s.gross > 0 ? `${((row.cents / s.gross) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title="Por forma de pagamento" empty={s.byMethod.length === 0 ? "Nenhuma venda paga neste período." : ""}>
        <table className="admin-table">
          <thead><tr><th>Forma</th><th>Vendas</th><th>Faturamento</th><th>Taxa estimada</th><th>Líquido da taxa</th></tr></thead>
          <tbody>
            {s.byMethod.map((row) => (
              <tr key={row.method}>
                <td><strong>{METHOD[row.method] || row.method}</strong></td>
                <td>{row.count}</td>
                <td>{formatMoneyCents(row.cents)}</td>
                <td>{formatMoneyCents(row.fees)}</td>
                <td>{formatMoneyCents(row.cents - row.fees)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title="Cupons usados" empty={s.byCoupon.length === 0 ? "Nenhum cupom usado nas vendas deste período." : ""}>
        <table className="admin-table">
          <thead><tr><th>Cupom</th><th>Vendas</th><th>Desconto dado</th></tr></thead>
          <tbody>
            {s.byCoupon.map((row) => (
              <tr key={row.code}>
                <td><strong>{row.code}</strong></td>
                <td>{row.count}</td>
                <td>{formatMoneyCents(row.discount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title="Dinheiro a caminho (últimos 30 dias)" empty={pending.length === 0 ? "Nenhum pedido aguardando pagamento." : ""}>
        <table className="admin-table">
          <thead><tr><th>Forma</th><th>Pedidos</th><th>Valor</th></tr></thead>
          <tbody>
            {Object.entries(pendingByMethod).map(([method, row]) => (
              <tr key={method}>
                <td><strong>{METHOD[method] || method}</strong></td>
                <td>{row.count}</td>
                <td>{formatMoneyCents(row.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>
    </div>
  );
}
