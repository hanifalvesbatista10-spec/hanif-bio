import { useState } from "react";
import RowActions from "../RowActions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, centsToInput, parseDay, parseMoneyToCents, toDayString } from "../../../services/finance";
import { deleteFinanceEntry, insertFinanceEntry, updateFinanceEntry } from "../../../services/financeApi";
import { formatMoneyCents } from "../../../services/checkoutApi";

const emptyForm = () => ({
  kind: "expense",
  category: EXPENSE_CATEGORIES[0],
  description: "",
  amount: "",
  occurred_on: toDayString(new Date()),
  recurrence: "none",
  recurrence_until: "",
});

const dateLabel = (value) => parseDay(value).toLocaleDateString("pt-BR");

export default function ExpensesTab({ entries, summary, onChanged }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const changeKind = (event) => {
    const kind = event.target.value;
    setForm((current) => ({ ...current, kind, category: (kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] }));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const edit = (entry) => {
    setEditingId(entry.id);
    setMessage("");
    setForm({
      kind: entry.kind,
      category: entry.category,
      description: entry.description || "",
      amount: centsToInput(entry.amount_cents),
      occurred_on: entry.occurred_on,
      recurrence: entry.recurrence,
      recurrence_until: entry.recurrence_until || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event) => {
    event.preventDefault();
    const cents = parseMoneyToCents(form.amount);
    if (!cents || cents <= 0) return notify("error", "Informe um valor maior que zero, por exemplo 80,00.");
    if (cents > 2000000000) return notify("error", "Esse valor é alto demais.");
    if (!form.category.trim()) return notify("error", "Informe a categoria.");
    if (!form.occurred_on) return notify("error", "Informe a data.");
    if (form.recurrence === "monthly" && form.recurrence_until && form.recurrence_until < form.occurred_on) {
      return notify("error", "O fim da repetição não pode ser antes da data de início.");
    }

    const payload = {
      kind: form.kind,
      category: form.category.trim().slice(0, 60),
      description: form.description.trim().slice(0, 300) || null,
      amount_cents: cents,
      occurred_on: form.occurred_on,
      recurrence: form.recurrence,
      recurrence_until: form.recurrence === "monthly" && form.recurrence_until ? form.recurrence_until : null,
    };

    setSaving(true);
    const { error } = editingId ? await updateFinanceEntry(editingId, payload) : await insertFinanceEntry(payload);
    setSaving(false);
    if (error) return notify("error", `Não foi possível salvar: ${error.message}`);

    notify("success", editingId ? "Lançamento atualizado." : "Lançamento salvo.");
    cancelEdit();
    onChanged();
  };

  const remove = async (entry) => {
    const what = entry.recurrence === "monthly" ? "Isso apaga o lançamento e todas as repetições mensais dele." : "";
    if (!window.confirm(`Excluir "${entry.category}" de ${formatMoneyCents(entry.amount_cents)}? ${what} Não tem como desfazer.`)) return;
    const { error } = await deleteFinanceEntry(entry.id);
    if (error) return notify("error", `Não foi possível excluir: ${error.message}`);
    if (editingId === entry.id) cancelEdit();
    notify("success", "Lançamento excluído.");
    onChanged();
  };

  const categories = form.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fin-expenses">
      <p className="adm-hint">
        Lance aqui o que não vem do checkout: anúncios, ferramentas, equipe, impostos e também vendas fechadas fora do site (ex.: pelo WhatsApp).
        Lançamentos <strong>mensais</strong> se repetem sozinhos todo mês, na mesma data, até o fim que você definir. Os lançamentos da categoria
        “Anúncios” alimentam o custo por venda e o ROI.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <form className="cp-form" onSubmit={submit}>
        <h3>{editingId ? "Editar lançamento" : "Novo lançamento"}</h3>
        <div className="cp-grid">
          <label>Tipo
            <select value={form.kind} onChange={changeKind}>
              <option value="expense">Despesa (saiu dinheiro)</option>
              <option value="income">Receita avulsa (entrou dinheiro)</option>
            </select>
          </label>
          <label>Categoria
            <input value={form.category} onChange={set("category")} list="fin-categories" maxLength={60} required />
            <datalist id="fin-categories">{categories.map((name) => <option key={name} value={name} />)}</datalist>
          </label>
          <label>Valor (R$)
            <input value={form.amount} onChange={set("amount")} inputMode="decimal" placeholder="Ex.: 80,00" required />
          </label>
          <label>Data
            <input type="date" value={form.occurred_on} onChange={set("occurred_on")} required />
          </label>
          <label>Repetição
            <select value={form.recurrence} onChange={set("recurrence")}>
              <option value="none">Só desta vez</option>
              <option value="monthly">Todo mês</option>
            </select>
          </label>
          {form.recurrence === "monthly" && (
            <label>Repetir até (opcional)
              <input type="date" value={form.recurrence_until} min={form.occurred_on} onChange={set("recurrence_until")} />
            </label>
          )}
        </div>
        <label>Observação (opcional)
          <input value={form.description} onChange={set("description")} maxLength={300} placeholder="Ex.: Meta Ads de outubro, assinatura do Daily..." />
        </label>
        <div className="form-actions">
          <button className="admin-button primary" type="submit" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar lançamento"}</button>
          {editingId && <button className="admin-button adm-ghost" type="button" onClick={cancelEdit} disabled={saving}>Cancelar</button>}
        </div>
      </form>

      <section className="fin-block">
        <h3>Despesas do período por categoria</h3>
        {summary.expensesByCategory.length === 0 ? (
          <p className="adm-hint">Nenhuma despesa neste período.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Categoria</th><th>Total</th><th>% das despesas</th></tr></thead>
              <tbody>
                {summary.expensesByCategory.map((row) => (
                  <tr key={row.category}>
                    <td><strong>{row.category}</strong></td>
                    <td>{formatMoneyCents(row.cents)}</td>
                    <td>{summary.expenses > 0 ? `${((row.cents / summary.expenses) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fin-block">
        <h3>Todos os lançamentos</h3>
        {entries.length === 0 ? (
          <div className="admin-empty">Nenhum lançamento ainda. Adicione o primeiro acima.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Repetição</th><th>Ações</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{dateLabel(entry.occurred_on)}</td>
                    <td><span className={`status-badge ${entry.kind === "income" ? "published" : "draft"}`}>{entry.kind === "income" ? "Receita" : "Despesa"}</span></td>
                    <td><strong>{entry.category}</strong>{entry.description && <small>{entry.description}</small>}</td>
                    <td>{formatMoneyCents(entry.amount_cents)}</td>
                    <td>
                      {entry.recurrence === "monthly" ? `Todo mês${entry.recurrence_until ? ` até ${dateLabel(entry.recurrence_until)}` : ""}` : "—"}
                    </td>
                    <td>
                      <RowActions
                        label={`Ações do lançamento ${entry.category}`}
                        primary={{ label: "Editar", onClick: () => edit(entry) }}
                        items={[{ label: "Excluir", danger: true, onClick: () => remove(entry) }]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
