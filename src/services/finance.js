// Cálculos da aba Financeiro. Funções puras (sem banco, sem tela) para que cada número possa ser conferido à parte.
// Todo dinheiro é inteiro em CENTAVOS. Receita conta pela data do pagamento (paid_at); reembolso, pela data do
// reembolso (refunded_at). Taxas do gateway e imposto são ESTIMATIVAS feitas com os percentuais cadastrados.

export const AD_CATEGORY = "Anúncios";
export const EXPENSE_CATEGORIES = [AD_CATEGORY, "Ferramentas e software", "Equipe e terceiros", "Impostos", "Taxas bancárias", "Equipamento", "Outros"];
export const INCOME_CATEGORIES = ["Venda fora do site", "Outros"];

export const PERIOD_PRESETS = [
  ["month", "Este mês"],
  ["last_month", "Mês passado"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
  ["year", "Este ano"],
  ["custom", "Personalizado"],
];

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date, offset = 0) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

// "2026-10-03" -> data local (sem o desvio de fuso que new Date("2026-10-03") causaria)
export function parseDay(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDayString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Intervalo [from, to): "to" é o primeiro instante FORA do período.
export function getRange(preset, customFrom, customTo, now = new Date()) {
  const today = startOfDay(now);
  if (preset === "last_month") return { from: startOfMonth(today, -1), to: startOfMonth(today) };
  if (preset === "30d") return { from: new Date(today.getTime() - 29 * DAY), to: new Date(today.getTime() + DAY) };
  if (preset === "90d") return { from: new Date(today.getTime() - 89 * DAY), to: new Date(today.getTime() + DAY) };
  if (preset === "year") return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear() + 1, 0, 1) };
  if (preset === "custom" && customFrom && customTo) {
    const from = parseDay(customFrom);
    const to = new Date(parseDay(customTo).getTime() + DAY);
    if (to > from) return { from, to };
  }
  return { from: startOfMonth(today), to: startOfMonth(today, 1) };
}

// Período imediatamente anterior, com a mesma duração (para "vs. período anterior").
export function previousRange({ from, to }) {
  const length = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - length), to: new Date(from.getTime()) };
}

const inRange = (value, { from, to }) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= from.getTime() && time < to.getTime();
};

// Repete os lançamentos mensais dentro do período. Dia 31 em mês curto cai no último dia do mês.
export function expandEntries(entries, range) {
  const out = [];
  for (const entry of entries || []) {
    const first = parseDay(entry.occurred_on);
    if (entry.recurrence !== "monthly") {
      if (first >= range.from && first < range.to) out.push({ ...entry, date: first });
      continue;
    }
    const until = entry.recurrence_until ? new Date(parseDay(entry.recurrence_until).getTime() + DAY) : null;
    for (let step = 0; step < 600; step += 1) {
      const year = first.getFullYear();
      const month = first.getMonth() + step;
      const day = Math.min(first.getDate(), daysInMonth(year, month));
      const date = new Date(year, month, day);
      if (date >= range.to) break;
      if (until && date >= until) break;
      if (date >= range.from) out.push({ ...entry, date });
    }
  }
  return out;
}

// Taxa estimada de UMA venda. Pix e cartão em %, boleto em valor fixo.
export function orderFee(order, settings) {
  const amount = Number(order.amount_cents) || 0;
  if (order.payment_method === "pix") return Math.round((amount * Number(settings?.fee_pix_percent || 0)) / 100);
  if (order.payment_method === "card") return Math.round((amount * Number(settings?.fee_card_percent || 0)) / 100);
  if (order.payment_method === "boleto") return Number(settings?.fee_boleto_cents || 0);
  return 0;
}

const sum = (list, pick) => list.reduce((total, item) => total + (Number(pick(item)) || 0), 0);

function groupBy(list, keyOf, build) {
  const map = new Map();
  for (const item of list) {
    const key = keyOf(item) || "—";
    map.set(key, build(map.get(key), item));
  }
  return [...map.entries()];
}

// Resume um período. "data" = { orders, commissions, entries }.
export function summarize(data, settings, range) {
  const paid = (data.orders || []).filter((o) => o.paid_at && ["paid", "refunded"].includes(o.status) && inRange(o.paid_at, range));
  const refunded = (data.orders || []).filter((o) => o.refunded_at && inRange(o.refunded_at, range));
  const commissions = (data.commissions || []).filter((c) => c.status !== "void" && inRange(c.created_at, range));
  const occurrences = expandEntries(data.entries, range);
  const expenses = occurrences.filter((e) => e.kind === "expense");
  const incomes = occurrences.filter((e) => e.kind === "income");

  const gross = sum(paid, (o) => o.amount_cents);
  const refunds = sum(refunded, (o) => o.amount_cents);
  const fees = sum(paid, (o) => orderFee(o, settings));
  const netRevenue = gross - refunds;
  const tax = settings?.tax_enabled ? Math.round((Math.max(0, netRevenue) * Number(settings.tax_percent || 0)) / 100) : 0;
  const commissionTotal = sum(commissions, (c) => c.amount_cents);
  const expenseTotal = sum(expenses, (e) => e.amount_cents);
  const otherIncome = sum(incomes, (e) => e.amount_cents);
  const adSpend = sum(expenses.filter((e) => e.category === AD_CATEGORY), (e) => e.amount_cents);

  const profit = netRevenue - fees - tax - commissionTotal - expenseTotal + otherIncome;
  const base = netRevenue + otherIncome;
  const paidCount = paid.length;

  return {
    paidCount,
    gross,
    refunds,
    refundCount: refunded.length,
    netRevenue,
    discounts: sum(paid, (o) => o.discount_cents),
    bumpRevenue: sum(paid, (o) => o.bump_cents),
    fees,
    tax,
    commissions: commissionTotal,
    expenses: expenseTotal,
    otherIncome,
    adSpend,
    profit,
    margin: netRevenue > 0 && base > 0 ? profit / base : null, // sem vendas, margem não tem significado
    ticket: paidCount ? Math.round(gross / paidCount) : 0,
    cpa: paidCount && adSpend > 0 ? Math.round(adSpend / paidCount) : null,
    roas: adSpend > 0 ? netRevenue / adSpend : null,
    byProduct: groupBy(paid, (o) => o.product?.title || "Produto removido", (acc, o) => ({ count: (acc?.count || 0) + 1, cents: (acc?.cents || 0) + o.amount_cents }))
      .map(([name, v]) => ({ name, ...v })).sort((a, b) => b.cents - a.cents),
    byMethod: groupBy(paid, (o) => o.payment_method, (acc, o) => ({ count: (acc?.count || 0) + 1, cents: (acc?.cents || 0) + o.amount_cents, fees: (acc?.fees || 0) + orderFee(o, settings) }))
      .map(([method, v]) => ({ method, ...v })).sort((a, b) => b.cents - a.cents),
    byCoupon: groupBy(paid.filter((o) => o.coupon_code), (o) => o.coupon_code, (acc, o) => ({ count: (acc?.count || 0) + 1, discount: (acc?.discount || 0) + (o.discount_cents || 0) }))
      .map(([code, v]) => ({ code, ...v })).sort((a, b) => b.count - a.count),
    expensesByCategory: groupBy(expenses, (e) => e.category, (acc, e) => (acc || 0) + e.amount_cents)
      .map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
  };
}

// Variação em % entre dois valores; null quando não dá para comparar (anterior zerado).
export function changePercent(current, previous) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Últimos N meses (do mais antigo ao atual) para o gráfico de receita x custos.
export function monthlySeries(data, settings, now = new Date(), months = 6) {
  const series = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const from = startOfMonth(now, -offset);
    const to = startOfMonth(now, -offset + 1);
    const s = summarize(data, settings, { from, to });
    series.push({
      key: toDayString(from).slice(0, 7),
      label: from.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      revenue: s.netRevenue + s.otherIncome,
      costs: s.fees + s.tax + s.commissions + s.expenses,
      profit: s.profit,
    });
  }
  return series;
}

// CSV para o contador: separador ";" e BOM para abrir certo no Excel. Texto que começaria com = + - @ ganha um apóstrofo
// na frente (impede que a planilha execute como fórmula). Números não são alterados.
export function csvCell(value) {
  if (typeof value === "number") return String(value).replace(".", ",");
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const centsToNumber = (cents) => Math.round(Number(cents) || 0) / 100;

export function buildCsv(header, rows) {
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

// "1.234,56" / "1234,5" / "R$ 80" -> centavos inteiros. Devolve null se não for um valor válido.
export function parseMoneyToCents(text) {
  const cleaned = String(text ?? "").replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

// "1,5" -> 1.5; vazio -> 0; fora de 0 a 100 ou inválido -> null.
export function parsePercent(text) {
  const cleaned = String(text ?? "").replace(/[%\s]/g, "").replace(",", ".");
  if (!cleaned) return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value * 100) / 100 : null;
}

export const formatPercent = (value) => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
export const centsToInput = (cents) => (Number(cents || 0) / 100).toFixed(2).replace(".", ",");

// Andamento da meta do mês (receita líquida + receitas avulsas até hoje) e projeção pelo ritmo atual.
export function goalProgress(goalCents, monthSummary, now = new Date()) {
  const achieved = monthSummary.netRevenue + monthSummary.otherIncome;
  const totalDays = daysInMonth(now.getFullYear(), now.getMonth());
  const today = now.getDate();
  const daysLeft = totalDays - today;
  const remaining = Math.max(0, goalCents - achieved);
  return {
    goal: goalCents,
    achieved,
    percent: goalCents > 0 ? (achieved / goalCents) * 100 : null,
    remaining,
    projected: achieved > 0 ? Math.round((achieved / today) * totalDays) : 0, // sem faturamento no mês não há ritmo a projetar
    daysLeft,
    perDay: daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining,
  };
}

// Quantas vendas cobrem as despesas do período. Usa a contribuição média de cada venda (o que sobra depois de
// taxa, imposto e comissão). Devolve null quando não há vendas para estimar.
export function breakEven(s) {
  if (s.paidCount === 0) return null;
  const contribution = (s.netRevenue - s.fees - s.tax - s.commissions) / s.paidCount;
  if (contribution <= 0) return null;
  const fixed = Math.max(0, s.expenses - s.otherIncome);
  return { contribution: Math.round(contribution), sales: Math.ceil(fixed / contribution), paidCount: s.paidCount, fixed };
}

const METHOD_LABEL = { card: "Cartão", pix: "Pix", boleto: "Boleto" };
const EXPORT_DATE = (value) => (value ? new Date(value).toLocaleDateString("pt-BR") : "");

// Linhas do CSV de vendas: pagamentos do período (e quando foram reembolsados, se foram).
export function salesCsv(orders, settings, range) {
  const rows = (orders || [])
    .filter((o) => o.paid_at && ["paid", "refunded"].includes(o.status) && inRange(o.paid_at, range))
    .sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at))
    .map((o) => [
      EXPORT_DATE(o.paid_at), o.id, o.buyer_name || "", o.product?.title || "", METHOD_LABEL[o.payment_method] || o.payment_method || "",
      o.coupon_code || "", centsToNumber(o.amount_cents), centsToNumber(o.discount_cents), centsToNumber(o.bump_cents),
      centsToNumber(orderFee(o, settings)), o.status === "refunded" ? "Reembolsado" : "Pago", EXPORT_DATE(o.refunded_at),
    ]);
  return buildCsv(
    ["Data do pagamento", "Pedido", "Comprador", "Produto", "Forma", "Cupom", "Valor pago (R$)", "Desconto (R$)", "Order bump (R$)", "Taxa estimada (R$)", "Situação", "Data do reembolso"],
    rows
  );
}

// Linhas do CSV de lançamentos: cada repetição mensal vira uma linha na data em que cai dentro do período.
export function entriesCsv(entries, range) {
  const rows = expandEntries(entries, range)
    .sort((a, b) => a.date - b.date)
    .map((e) => [e.date.toLocaleDateString("pt-BR"), e.kind === "income" ? "Receita" : "Despesa", e.category, e.description || "", centsToNumber(e.amount_cents), e.recurrence === "monthly" ? "Mensal" : "Única"]);
  return buildCsv(["Data", "Tipo", "Categoria", "Observação", "Valor (R$)", "Repetição"], rows);
}
