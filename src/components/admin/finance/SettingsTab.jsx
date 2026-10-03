import { useState } from "react";
import { centsToInput, parseMoneyToCents, parsePercent } from "../../../services/finance";
import { saveFinanceSettings } from "../../../services/financeApi";

const percentInput = (value) => String(value ?? 0).replace(".", ",");

export default function SettingsTab({ settings, onSaved }) {
  const [form, setForm] = useState({
    fee_pix_percent: percentInput(settings.fee_pix_percent),
    fee_card_percent: percentInput(settings.fee_card_percent),
    fee_boleto: centsToInput(settings.fee_boleto_cents),
    tax_enabled: Boolean(settings.tax_enabled),
    tax_percent: percentInput(settings.tax_percent),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const pix = parsePercent(form.fee_pix_percent);
    const card = parsePercent(form.fee_card_percent);
    const tax = parsePercent(form.tax_percent);
    const boleto = form.fee_boleto.trim() === "" ? 0 : parseMoneyToCents(form.fee_boleto);
    if (pix === null || card === null || tax === null) return notify("error", "As porcentagens precisam estar entre 0 e 100, por exemplo 2,99.");
    if (boleto === null) return notify("error", "Informe a taxa do boleto em reais, por exemplo 3,50.");

    setSaving(true);
    const { error } = await saveFinanceSettings({
      fee_pix_percent: pix,
      fee_card_percent: card,
      fee_boleto_cents: boleto,
      tax_enabled: form.tax_enabled,
      tax_percent: tax,
    });
    setSaving(false);
    if (error) return notify("error", `Não foi possível salvar: ${error.message}`);
    notify("success", "Configurações salvas. Os números do painel já usam os novos percentuais.");
    onSaved();
  };

  return (
    <div className="fin-settings">
      <p className="adm-hint">
        Estes valores servem para <strong>estimar</strong> quanto sobra de cada venda. O banco não guarda a taxa que o gateway realmente cobrou, então o painel aplica
        o percentual que você informar aqui, em todas as vendas, inclusive as antigas: ao mudar uma taxa, os números do passado mudam junto.
        Confira os valores no seu contrato com a InfinitePay (Pix e cartão) e o Asaas (boleto).
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <form className="cp-form" onSubmit={submit}>
        <h3>Taxas de pagamento</h3>
        <div className="cp-grid">
          <label>Pix (% por venda)
            <input value={form.fee_pix_percent} onChange={set("fee_pix_percent")} inputMode="decimal" placeholder="Ex.: 0,99" />
          </label>
          <label>Cartão (% por venda)
            <input value={form.fee_card_percent} onChange={set("fee_card_percent")} inputMode="decimal" placeholder="Ex.: 4,99" />
          </label>
          <label>Boleto (R$ fixo por boleto pago)
            <input value={form.fee_boleto} onChange={set("fee_boleto")} inputMode="decimal" placeholder="Ex.: 3,49" />
          </label>
        </div>

        <h3>Imposto</h3>
        <label className="cp-check">
          <input type="checkbox" checked={form.tax_enabled} onChange={(e) => setForm((current) => ({ ...current, tax_enabled: e.target.checked }))} />
          Estimar imposto sobre o faturamento
        </label>
        {form.tax_enabled && (
          <div className="cp-grid">
            <label>Alíquota (% do faturamento líquido de reembolsos)
              <input value={form.tax_percent} onChange={set("tax_percent")} inputMode="decimal" placeholder="Ex.: 6" />
            </label>
          </div>
        )}
        <p className="adm-hint">
          Deixe desligado até definir com o seu contador. Se você for MEI, o imposto é um valor fixo por mês: lance como despesa mensal na categoria “Impostos”,
          em vez de usar uma porcentagem.
        </p>

        <div className="form-actions">
          <button className="admin-button primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar configurações"}</button>
        </div>
      </form>
    </div>
  );
}
