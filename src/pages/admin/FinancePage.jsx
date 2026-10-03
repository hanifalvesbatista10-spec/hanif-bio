import { useCallback, useEffect, useMemo, useState } from "react";
import { PERIOD_PRESETS, entriesCsv, getRange, monthlySeries, previousRange, salesCsv, summarize, toDayString } from "../../services/finance";
import { isMissingFinanceTable, loadFinanceData } from "../../services/financeApi";
import SummaryTab from "../../components/admin/finance/SummaryTab";
import SalesTab from "../../components/admin/finance/SalesTab";
import ExpensesTab from "../../components/admin/finance/ExpensesTab";
import SettingsTab from "../../components/admin/finance/SettingsTab";
import CommissionsTab from "../../components/admin/finance/CommissionsTab";
import GoalsTab from "../../components/admin/finance/GoalsTab";
import "../../styles/finance-admin.css";

const TABS = [
  ["resumo", "Resumo"],
  ["vendas", "Vendas"],
  ["despesas", "Despesas"],
  ["comissoes", "Comissões"],
  ["metas", "Metas e ROI"],
  ["configurar", "Configurar"],
];

const DEFAULT_SETTINGS = {
  fee_pix_percent: 0,
  fee_card_percent: 0,
  fee_boleto_cents: 0,
  tax_enabled: false,
  tax_percent: 0,
  monthly_goal_cents: 0,
};

const dayLabel = (date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Baixa um CSV gerado no navegador (nada é enviado a servidor nenhum).
function downloadCsv(content, name) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FinancePage() {
  const [tab, setTab] = useState("resumo");
  const [preset, setPreset] = useState("month");
  const [customFrom, setCustomFrom] = useState(() => toDayString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => toDayString(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  const range = useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const prevRange = useMemo(() => previousRange(range), [range]);

  // Busca desde o começo do período anterior ou de 6 meses atrás (o que for mais antigo), para o comparativo e o gráfico.
  const sinceKey = useMemo(() => {
    const sixMonths = new Date();
    sixMonths.setDate(1);
    sixMonths.setMonth(sixMonths.getMonth() - 5);
    sixMonths.setHours(0, 0, 0, 0);
    return (prevRange.from < sixMonths ? prevRange.from : sixMonths).toISOString();
  }, [prevRange]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await loadFinanceData(new Date(sinceKey));
    if (result.error) {
      if (isMissingFinanceTable(result.error)) setMissing(true);
      else setError(`Não foi possível carregar o financeiro: ${result.error.message}`);
      setData(null);
    } else {
      setMissing(false);
      setError("");
      setData(result);
    }
    setLoading(false);
  }, [sinceKey]);

  useEffect(() => {
    load();
  }, [load]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(data?.settings || {}) }), [data]);
  const summary = useMemo(() => (data ? summarize(data, settings, range) : null), [data, settings, range]);
  const previous = useMemo(() => (data ? summarize(data, settings, prevRange) : null), [data, settings, prevRange]);
  const monthSummary = useMemo(() => (data ? summarize(data, settings, getRange("month")) : null), [data, settings]);
  const series = useMemo(() => (data ? monthlySeries(data, settings) : []), [data, settings]);
  const pendingTotal = useMemo(() => (data?.pending || []).reduce((total, order) => total + (order.amount_cents || 0), 0), [data]);

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">
          O banco ainda não tem as tabelas do financeiro. Execute <strong>supabase/50_financeiro.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      </section>
    );
  }

  const lastDay = new Date(range.to.getTime() - 1);
  const fileTag = `${toDayString(range.from)}_a_${toDayString(lastDay)}`;
  const exportSales = () => downloadCsv(salesCsv(data.orders, settings, range), `vendas-${fileTag}.csv`);
  const exportEntries = () => downloadCsv(entriesCsv(data.entries, range), `despesas-e-receitas-${fileTag}.csv`);

  return (
    <section className="admin-section fin-page">
      <div className="admin-section-head">
        <div>
          <span>GESTÃO</span>
          <h2>Financeiro</h2>
        </div>
        {data && (
          <div className="fin-export">
            <button type="button" className="admin-button" onClick={exportSales}>Exportar vendas (CSV)</button>
            <button type="button" className="admin-button" onClick={exportEntries}>Exportar despesas e receitas (CSV)</button>
          </div>
        )}
      </div>

      <div className="fin-toolbar">
        <div className="adm-segment" role="group" aria-label="Período">
          {PERIOD_PRESETS.map(([value, label]) => (
            <button key={value} type="button" className={preset === value ? "is-active" : ""} aria-pressed={preset === value} onClick={() => setPreset(value)}>
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="fin-custom">
            <label>De<input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} /></label>
            <label>Até<input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} /></label>
          </div>
        )}
        <span className="fin-range">{dayLabel(range.from)} a {dayLabel(lastDay)}</span>
      </div>

      <div className="adm-segment fin-tabs" role="tablist" aria-label="Seções do financeiro">
        {TABS.map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="admin-alert error" role="alert">{error}</div>}
      {data?.truncated && (
        <div className="admin-alert" role="status">Há mais de 5.000 pedidos neste intervalo; os números podem estar incompletos. Use um período menor.</div>
      )}

      {loading && !data ? (
        <div className="admin-empty">Carregando...</div>
      ) : !data ? null : (
        <div className={loading ? "fin-body is-loading" : "fin-body"}>
          {tab === "resumo" && <SummaryTab summary={summary} previous={previous} series={series} pendingTotal={pendingTotal} pendingCount={data.pending.length} settings={settings} />}
          {tab === "vendas" && <SalesTab summary={summary} pending={data.pending} />}
          {tab === "despesas" && <ExpensesTab entries={data.entries} summary={summary} onChanged={load} />}
          {tab === "comissoes" && (
            <CommissionsTab
              owedCommissions={data.owedCommissions}
              commissions={data.commissions}
              affiliates={data.affiliates}
              minimumPayoutCents={data.minimumPayoutCents}
              range={range}
              onChanged={load}
            />
          )}
          {tab === "metas" && <GoalsTab settings={settings} monthSummary={monthSummary} summary={summary} previous={previous} onSaved={load} />}
          {tab === "configurar" && <SettingsTab settings={settings} onSaved={load} />}
        </div>
      )}
    </section>
  );
}
