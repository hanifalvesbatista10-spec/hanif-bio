import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { feeFromTest, loadInstallmentSettings, planInstallments } from "../../services/installments";
import Installments from "../ui/Installments";
import "../../styles/installments.css";

const SAMPLE_CENTS = 29700;

// Painel em Produtos: liga o destaque "12x de R$ X" nos preços e define o juro do cartão que entra na conta.
export default function InstallmentsSettings() {
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [max, setMax] = useState("12");
  const [fee, setFee] = useState("");
  const [testPrice, setTestPrice] = useState("");
  const [testTotal, setTestTotal] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null); // { type: "ok" | "err", text }

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("installments_fee_percent,installments_max")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMissing(true);
        else if (data) {
          setMax(String(data.installments_max ?? 12));
          setFee(data.installments_fee_percent === null || data.installments_fee_percent === undefined ? "" : String(data.installments_fee_percent).replace(".", ","));
        }
        setLoading(false);
      });
  }, []);

  const feeNumber = fee.trim() === "" ? null : Number(fee.replace(",", "."));
  const feeValid = feeNumber === null || (Number.isFinite(feeNumber) && feeNumber >= 0 && feeNumber <= 60);
  const preview = feeNumber !== null && feeValid ? planInstallments(SAMPLE_CENTS, { feePercent: feeNumber, max: Number(max) }) : null;

  const useTest = () => {
    const value = feeFromTest(testPrice, testTotal);
    if (value === null) return setNote({ type: "err", text: "Confira os valores: o total no cartão deve ser igual ou maior que o preço do produto." });
    setFee(String(value).replace(".", ","));
    setNote({ type: "ok", text: `Juro calculado: ${String(value).replace(".", ",")}%. Confira a prévia e clique em Salvar.` });
  };

  const save = async (value) => {
    if (value !== null && !feeValid) return setNote({ type: "err", text: "Informe o juro entre 0 e 60 (ex.: 18,4)." });
    setSaving(true);
    setNote(null);
    const { error } = await supabase
      .from("site_settings")
      .update({ installments_fee_percent: value, installments_max: Number(max) })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      return setNote({
        type: "err",
        text: /installments/.test(error.message) ? "O banco ainda não tem o parcelamento em destaque. Execute supabase/28_parcelamento_em_destaque.sql no SQL Editor e tente de novo." : error.message,
      });
    }
    await loadInstallmentSettings(true);
    setNote({ type: "ok", text: value === null ? "Destaque de parcelas desligado." : "Salvo. Os preços do site já mostram as parcelas." });
  };

  if (loading) return null;

  return (
    <section className="ins-card" aria-labelledby="ins-title">
      <h3 id="ins-title">Parcelamento em destaque nos preços</h3>
      <p>
        Mostra “12x de R$ 27,90” nos produtos com checkout do site, já com o juro que o comprador paga no cartão, e o valor à vista logo abaixo.
        Deixe o juro em branco para desligar.
      </p>

      {missing ? (
        <div className="ins-msg err">O banco ainda não tem este recurso. Execute <strong>supabase/28_parcelamento_em_destaque.sql</strong> no SQL Editor do Supabase e recarregue.</div>
      ) : (
        <>
          <div className="ins-grid">
            <label>Número de parcelas
              <select value={max} onChange={(event) => setMax(event.target.value)}>
                {Array.from({ length: 11 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}x</option>)}
              </select>
            </label>
            <label>Juro total do parcelamento (%)
              <input value={fee} onChange={(event) => setFee(event.target.value)} inputMode="decimal" placeholder="Ex.: 18,4" />
              <small>Quanto o comprador paga a mais, no total, ao parcelar em {max}x.</small>
            </label>
          </div>

          <div className="ins-test">
            <strong>Não sabe o juro? Descubra com um teste</strong>
            <p>Abra o checkout de um produto, escolha Pix ou cartão e, na página da InfinitePay, selecione {max}x. Anote o preço do produto e o total que aparece no parcelamento.</p>
            <div className="ins-test-row">
              <label>Preço do produto (R$)
                <input value={testPrice} onChange={(event) => setTestPrice(event.target.value)} inputMode="decimal" placeholder="297,00" />
              </label>
              <label>Total no cartão em {max}x (R$)
                <input value={testTotal} onChange={(event) => setTestTotal(event.target.value)} inputMode="decimal" placeholder="351,65" />
              </label>
              <button type="button" className="ins-btn is-ghost" onClick={useTest}>Calcular o juro</button>
            </div>
          </div>

          {preview && (
            <div className="ins-preview">
              <small>Prévia com um produto de R$ 297,00</small>
              <Installments cents={SAMPLE_CENTS} />
            </div>
          )}
          {feeNumber !== null && feeValid && !preview && <div className="ins-msg err">Com esses valores a parcela ficaria abaixo de R$ 5,00, então o destaque não seria exibido.</div>}

          <div className="ins-actions">
            <button type="button" className="ins-btn" disabled={saving || feeNumber === null} onClick={() => save(feeNumber)}>{saving ? "Salvando..." : "Salvar"}</button>
            <button type="button" className="ins-btn is-ghost" disabled={saving} onClick={() => { setFee(""); save(null); }}>Desligar destaque</button>
          </div>
        </>
      )}
      {note && <div className={`ins-msg ${note.type}`} role="status">{note.text}</div>}
    </section>
  );
}
