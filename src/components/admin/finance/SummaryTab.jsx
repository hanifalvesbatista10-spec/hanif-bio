import { changePercent, formatPercent } from "../../../services/finance";
import { formatMoneyCents } from "../../../services/checkoutApi";

// Seta e porcentagem de variação. "inverse": para custos, subir é ruim.
export function Delta({ current, previous, inverse = false }) {
  const change = changePercent(current, previous);
  if (change === null && !current) return null;
  if (change === null) return <small className="fin-delta">sem período anterior para comparar</small>;
  const up = change > 0;
  const good = inverse ? !up : up;
  const flat = Math.abs(change) < 0.05;
  return (
    <small className={`fin-delta ${flat ? "" : good ? "is-good" : "is-bad"}`}>
      {flat ? "igual ao período anterior" : `${up ? "▲" : "▼"} ${Math.abs(change).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. período anterior`}
    </small>
  );
}

function MonthlyChart({ series }) {
  const max = Math.max(1, ...series.flatMap((month) => [month.revenue, month.costs]));
  const width = 600;
  const height = 228;
  const base = 176;
  const barWidth = 26;
  const slot = width / series.length;
  const scale = (value) => Math.max(value > 0 ? 3 : 0, (value / max) * (base - 14));

  return (
    <figure className="fin-chart">
      <figcaption>Receita e custos dos últimos {series.length} meses</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de barras com receita e custos mensais" preserveAspectRatio="xMidYMid meet">
        <line x1="0" x2={width} y1={base} y2={base} className="fin-axis" />
        {series.map((month, index) => {
          const center = slot * index + slot / 2;
          const revenueHeight = scale(month.revenue);
          const costsHeight = scale(month.costs);
          return (
            <g key={month.key}>
              <rect x={center - barWidth - 2} y={base - revenueHeight} width={barWidth} height={revenueHeight} rx="4" className="fin-bar-revenue">
                <title>{`${month.label}: receita ${formatMoneyCents(month.revenue)}`}</title>
              </rect>
              <rect x={center + 2} y={base - costsHeight} width={barWidth} height={costsHeight} rx="4" className="fin-bar-costs">
                <title>{`${month.label}: custos ${formatMoneyCents(month.costs)}`}</title>
              </rect>
              <text x={center} y={base + 20} textAnchor="middle" className="fin-chart-label">{month.label}</text>
              <text x={center} y={base + 36} textAnchor="middle" className={`fin-chart-profit ${month.profit < 0 ? "is-bad" : ""}`}>{formatMoneyCents(month.profit)}</text>
            </g>
          );
        })}
      </svg>
      <div className="fin-legend">
        <span><i className="fin-bar-revenue" /> Receita (líquida de reembolsos)</span>
        <span><i className="fin-bar-costs" /> Custos (taxas, imposto, comissões, despesas)</span>
        <span>Valor sob o mês = lucro</span>
      </div>
    </figure>
  );
}

export default function SummaryTab({ summary: s, previous: p, series, pendingTotal, pendingCount, settings }) {
  const empty = s.paidCount === 0 && s.expenses === 0 && s.otherIncome === 0;

  const rows = [
    { label: "Faturamento bruto", value: s.gross, sign: "", note: `${s.paidCount} venda${s.paidCount === 1 ? "" : "s"} paga${s.paidCount === 1 ? "" : "s"}` },
    { label: "Reembolsos", value: -s.refunds, sign: "−", note: s.refundCount ? `${s.refundCount} pedido${s.refundCount === 1 ? "" : "s"}` : "" },
    { label: "Taxas de pagamento (estimadas)", value: -s.fees, sign: "−", note: s.fees === 0 && s.paidCount > 0 ? "cadastre as taxas em Configurar" : "" },
    { label: "Imposto (estimado)", value: -s.tax, sign: "−", note: settings.tax_enabled ? `${formatPercent(settings.tax_percent)} do líquido` : "desligado em Configurar" },
    { label: "Comissões de afiliados", value: -s.commissions, sign: "−", note: "" },
    { label: "Despesas lançadas", value: -s.expenses, sign: "−", note: s.adSpend ? `anúncios: ${formatMoneyCents(s.adSpend)}` : "" },
    { label: "Receitas avulsas", value: s.otherIncome, sign: "+", note: "vendas fora do site e outras" },
  ];

  return (
    <div className="fin-summary">
      {empty && (
        <p className="adm-hint">
          Ainda não há vendas pagas nem lançamentos neste período. Assim que o checkout vender, os números aparecem aqui sozinhos. Para custos e receitas fora do site,
          use a aba Despesas.
        </p>
      )}

      <div className="fin-hero">
        <div>
          <span>Lucro no período</span>
          <strong className={s.profit < 0 ? "is-bad" : ""}>{formatMoneyCents(s.profit)}</strong>
          <small>{s.margin === null ? "a margem aparece quando houver vendas no período" : `margem de ${formatPercent(Math.round(s.margin * 1000) / 10)}`}</small>
        </div>
        <Delta current={s.profit} previous={p.profit} />
      </div>

      <div className="fin-waterfall" role="table" aria-label="Como o lucro é calculado">
        {rows.map((row) => (
          <div className="fin-row" role="row" key={row.label}>
            <span role="cell">{row.label}{row.note && <small>{row.note}</small>}</span>
            <strong role="cell" className={row.value < 0 ? "is-neg" : ""}>{row.value === 0 ? formatMoneyCents(0) : `${row.value < 0 ? "−" : row.sign === "+" ? "+" : ""} ${formatMoneyCents(Math.abs(row.value))}`}</strong>
          </div>
        ))}
        <div className="fin-row is-total" role="row">
          <span role="cell">Lucro</span>
          <strong role="cell" className={s.profit < 0 ? "is-bad" : ""}>{formatMoneyCents(s.profit)}</strong>
        </div>
      </div>

      <div className="ord-stats fin-kpis">
        <div><strong>{formatMoneyCents(s.gross)}</strong><span>faturamento bruto</span><Delta current={s.gross} previous={p.gross} /></div>
        <div><strong>{s.paidCount}</strong><span>vendas pagas</span><Delta current={s.paidCount} previous={p.paidCount} /></div>
        <div><strong>{formatMoneyCents(s.ticket)}</strong><span>ticket médio</span></div>
        <div><strong>{formatMoneyCents(s.discounts)}</strong><span>em descontos de cupom</span></div>
        <div><strong>{formatMoneyCents(s.bumpRevenue)}</strong><span>vindo de order bumps</span></div>
        <div><strong>{formatMoneyCents(pendingTotal)}</strong><span>a caminho ({pendingCount} aguardando pagamento, últimos 30 dias)</span></div>
      </div>

      <MonthlyChart series={series} />

      <p className="adm-hint">
        Taxas de pagamento e imposto são <strong>estimativas</strong> feitas com os percentuais de Configurar; o valor real depende do seu contrato com a InfinitePay e o Asaas.
        A receita conta no dia em que o pagamento é confirmado, e o reembolso no dia em que é marcado.
      </p>
    </div>
  );
}
