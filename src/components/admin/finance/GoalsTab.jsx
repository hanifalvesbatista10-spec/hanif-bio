import { useState } from "react";
import { breakEven, centsToInput, formatPercent, goalProgress, parseMoneyToCents } from "../../../services/finance";
import { saveFinanceSettings } from "../../../services/financeApi";
import { formatMoneyCents } from "../../../services/checkoutApi";
import { Delta } from "./SummaryTab";

export default function GoalsTab({ settings, monthSummary, summary, previous, onSaved }) {
  const [goal, setGoal] = useState(settings.monthly_goal_cents ? centsToInput(settings.monthly_goal_cents) : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const save = async (event) => {
    event.preventDefault();
    const cents = goal.trim() === "" ? 0 : parseMoneyToCents(goal);
    if (cents === null || cents > 2000000000) return notify("error", "Informe a meta em reais, por exemplo 10.000,00.");
    setSaving(true);
    const { error } = await saveFinanceSettings({ monthly_goal_cents: cents });
    setSaving(false);
    if (error) return notify("error", `Não foi possível salvar: ${error.message}`);
    notify("success", cents ? "Meta salva." : "Meta removida.");
    onSaved();
  };

  const progress = goalProgress(settings.monthly_goal_cents || 0, monthSummary);
  const hit = progress.goal > 0 && progress.achieved >= progress.goal;
  const barWidth = Math.min(100, Math.max(0, progress.percent || 0));
  const equilibrium = breakEven(summary);

  return (
    <div className="fin-goals">
      <section className="fin-block">
        <h3>Meta de faturamento do mês</h3>
        <form className="cp-form fin-goal-form" onSubmit={save}>
          <label>Meta mensal (R$)
            <input value={goal} onChange={(e) => setGoal(e.target.value)} inputMode="decimal" placeholder="Ex.: 10.000,00 (vazio = sem meta)" />
          </label>
          <button className="admin-button primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar meta"}</button>
        </form>
        {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

        {progress.goal > 0 ? (
          <div className="fin-goal-card">
            <div className="fin-goal-top">
              <strong>{formatMoneyCents(progress.achieved)}</strong>
              <span>de {formatMoneyCents(progress.goal)} ({formatPercent(Math.round(progress.percent * 10) / 10)})</span>
            </div>
            <div className="fin-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(barWidth)} aria-label="Progresso da meta do mês">
              <span className={hit ? "is-hit" : ""} style={{ width: `${barWidth}%` }} />
            </div>
            <ul className="fin-goal-facts">
              {hit ? (
                <li><strong>Meta batida!</strong> Faltavam {formatMoneyCents(progress.goal)} e já passou {formatMoneyCents(progress.achieved - progress.goal)}.</li>
              ) : (
                <>
                  <li>Faltam <strong>{formatMoneyCents(progress.remaining)}</strong>{progress.daysLeft > 0 ? ` em ${progress.daysLeft} dia${progress.daysLeft === 1 ? "" : "s"}` : " e hoje é o último dia do mês"}.</li>
                  {progress.daysLeft > 0 && <li>Para chegar lá, são cerca de <strong>{formatMoneyCents(progress.perDay)} por dia</strong> daqui para frente.</li>}
                  {progress.projected > 0 ? (
                    <li>No ritmo atual, o mês fecha em torno de <strong>{formatMoneyCents(progress.projected)}</strong>{progress.projected >= progress.goal ? " (acima da meta)" : " (abaixo da meta)"}.</li>
                  ) : (
                    <li>Ainda não há faturamento positivo neste mês para projetar o ritmo.</li>
                  )}
                </>
              )}
            </ul>
            <p className="adm-hint">Conta o faturamento do mês corrente, líquido de reembolsos, mais as receitas avulsas. Não depende do período escolhido no topo.</p>
          </div>
        ) : (
          <p className="adm-hint">Defina uma meta mensal acima para acompanhar o andamento, a projeção e quanto falta por dia.</p>
        )}
      </section>

      <section className="fin-block">
        <h3>Retorno dos anúncios (período escolhido)</h3>
        {summary.adSpend === 0 ? (
          <p className="adm-hint">
            Nenhum gasto com anúncios neste período. Lance o valor investido na aba Despesas, com a categoria <strong>Anúncios</strong>, e o custo por venda e o
            retorno aparecem aqui.
          </p>
        ) : (
          <>
            <div className="ord-stats">
              <div><strong>{formatMoneyCents(summary.adSpend)}</strong><span>investido em anúncios</span><Delta current={summary.adSpend} previous={previous.adSpend} inverse /></div>
              <div>
                <strong>{summary.cpa === null ? "—" : formatMoneyCents(summary.cpa)}</strong>
                <span>custo por venda</span>
                {summary.cpa !== null && previous.cpa !== null && <Delta current={summary.cpa} previous={previous.cpa} inverse />}
              </div>
              <div>
                <strong>{summary.roas === null ? "—" : `${summary.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`}</strong>
                <span>retorno (faturamento ÷ anúncios)</span>
              </div>
              <div>
                <strong className={summary.netRevenue - summary.adSpend < 0 ? "fin-neg" : ""}>{formatMoneyCents(summary.netRevenue - summary.adSpend)}</strong>
                <span>faturamento depois de pagar os anúncios</span>
              </div>
            </div>
            <p className="adm-hint">
              {summary.paidCount > 0
                ? `Cada venda custou ${formatMoneyCents(summary.cpa)} em anúncios e vendeu, em média, ${formatMoneyCents(summary.ticket)}. `
                : "Ainda não houve vendas pagas neste período para dividir o gasto. "}
              Retorno de 1x quer dizer que o faturamento só pagou o anúncio, antes de contar taxas, comissões e outras despesas.
            </p>
          </>
        )}
      </section>

      <section className="fin-block">
        <h3>Ponto de equilíbrio (período escolhido)</h3>
        {equilibrium === null ? (
          <p className="adm-hint">Precisa de vendas pagas com margem positiva no período para estimar quantas vendas cobrem as despesas.</p>
        ) : (
          <>
            <div className="ord-stats">
              <div><strong>{formatMoneyCents(equilibrium.contribution)}</strong><span>sobra por venda, em média (depois de taxa, imposto e comissão)</span></div>
              <div><strong>{formatMoneyCents(equilibrium.fixed)}</strong><span>despesas do período (menos receitas avulsas)</span></div>
              <div><strong>{equilibrium.sales}</strong><span>venda{equilibrium.sales === 1 ? "" : "s"} para cobrir as despesas</span></div>
            </div>
            <p className="adm-hint">
              {equilibrium.paidCount >= equilibrium.sales
                ? `Você fez ${equilibrium.paidCount} venda${equilibrium.paidCount === 1 ? "" : "s"}, então as despesas do período já estão cobertas.`
                : `Você fez ${equilibrium.paidCount}; faltam ${equilibrium.sales - equilibrium.paidCount} para cobrir as despesas do período.`}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
