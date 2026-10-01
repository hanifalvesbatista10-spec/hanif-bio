import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { formatMoneyCents } from "../../services/checkoutApi";
import "../../styles/forms-run.css";
import "../../styles/forms-public.css";

const STATUS_LABEL = { active: "Ativo", blocked: "Bloqueado", pending: "Pendente", rejected: "Recusado" };

// Painel do afiliado sem login: confere e-mail + código do cupom (RPC affiliate_portal) e mostra só os
// números dessa pessoa. Não guarda sessão; cada consulta é nova.
export default function AffiliatePortalPage() {
  const [form, setForm] = useState({ email: "", code: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    document.title = "Painel do afiliado | Hanif Alves";
  }, []);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const email = form.email.trim().toLowerCase();
    const code = form.code.trim().toUpperCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError("Informe um e-mail válido.");
    if (!code) return setError("Informe o seu código de afiliado.");

    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("affiliate_portal", { p_email: email, p_code: code });
    setLoading(false);

    if (rpcError) {
      if (/does not exist|schema cache/.test(rpcError.message)) return setError("O painel ainda está sendo configurado. Tente novamente mais tarde.");
      return setError("Não foi possível consultar agora. Tente de novo em instantes.");
    }
    if (!data || data.length === 0) return setError("Não encontramos afiliado com esse e-mail e código. Confira os dados e tente de novo.");
    setResult(data[0]);
  };

  const backToSearch = () => {
    setResult(null);
    setError("");
  };

  return (
    <main className="pf-page">
      <div className="pf-shell">
        <header className="pf-hero">
          <span>Afiliados</span>
          <h1>Painel do afiliado</h1>
          <p>Consulte suas vendas, sua comissão atual e o que já foi pago — só com o seu e-mail e o seu código de afiliado, sem senha.</p>
        </header>

        {!result ? (
          <form className="fx fb-form" onSubmit={submit} noValidate>
            <section className="fx-card">
              <h2>Consultar meu painel</h2>
              <div className="fx-id">
                <label><span>E-mail *</span><input className="fx-input" type="email" value={form.email} onChange={set("email")} autoComplete="email" /></label>
                <label><span>Código de afiliado *</span><input className="fx-input" value={form.code} onChange={set("code")} placeholder="Ex.: ANA10" autoComplete="off" /></label>
              </div>
            </section>

            {error && <div className="fx-error" role="alert">{error}</div>}
            <button className="fx-submit" type="submit" disabled={loading}>{loading ? "Consultando..." : "Consultar"}</button>
          </form>
        ) : (
          <div className="fx fb-form">
            <section className="fx-card">
              <h2>Olá, {result.full_name}</h2>
              <p className="fx-hint" style={{ marginBottom: 16 }}>Status: {STATUS_LABEL[result.status] || result.status}</p>

              <div className="fx-id">
                <div>
                  <span className="fx-hint">Comissão atual</span>
                  <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>{Number(result.current_percent)}%</p>
                </div>
                <div>
                  <span className="fx-hint">Vendas pagas neste mês</span>
                  <p style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>{result.sales_this_month}</p>
                </div>
              </div>

              {result.next_tier_sales != null && result.next_tier_percent != null && (
                <p className="fx-hint" style={{ marginTop: 4 }}>
                  Faltam <strong>{result.next_tier_sales}</strong> venda{result.next_tier_sales === 1 ? "" : "s"} neste mês para sua comissão subir para <strong>{Number(result.next_tier_percent)}%</strong>.
                </p>
              )}

              <div className="fx-id" style={{ marginTop: 20 }}>
                <div>
                  <span className="fx-hint">A receber</span>
                  <p style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{formatMoneyCents(result.owed_cents || 0)}</p>
                </div>
                <div>
                  <span className="fx-hint">Já pago</span>
                  <p style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{formatMoneyCents(result.paid_cents || 0)}</p>
                </div>
              </div>
              <p className="fx-hint">O pagamento é feito por fora (Pix), uma vez por mês.</p>

              {result.materials_url && (
                <p style={{ marginTop: 16 }}>
                  <a className="fx-submit" href={result.materials_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}>
                    Baixar materiais oficiais
                  </a>
                </p>
              )}

              <p className="fx-hint" style={{ marginTop: 20 }}>
                É proibida autoindicação, criação de vendas falsas ou uso indevido do código. O uso indevido leva ao bloqueio.
              </p>
            </section>

            <button className="fx-submit" type="button" onClick={backToSearch} style={{ background: "transparent", border: "1px solid var(--fx-border, #ccc)" }}>
              Consultar outro e-mail
            </button>
          </div>
        )}

        <p style={{ marginTop: 24 }}><Link to="/">← Voltar para o site</Link></p>
      </div>
    </main>
  );
}
