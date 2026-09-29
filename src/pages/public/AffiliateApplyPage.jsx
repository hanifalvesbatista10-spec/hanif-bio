import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import "../../styles/forms-run.css";
import "../../styles/forms-public.css";

// Formulário público "quero ser afiliado". Cai sempre como pedido pendente: só o instrutor aprova, define o
// cupom exclusivo e a comissão. Nada aqui libera acesso ou comissão sozinho.
export default function AffiliateApplyPage() {
  const [open, setOpen] = useState(null); // null = carregando, true/false
  const [form, setForm] = useState({ name: "", email: "", phone: "", pix_key: "", notes: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Seja afiliado | Hanif Alves";
    supabase
      .rpc("affiliate_signup_open")
      .then(({ data, error: rpcError }) => setOpen(rpcError ? true : data !== false))
      .catch(() => setOpen(true));
  }, []);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.website.trim()) return; // campo-armadilha: só robô preenche, sai calado
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (name.length < 2) return setError("Informe o seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError("Informe um e-mail válido.");

    setSending(true);
    const { error: insertError } = await supabase.from("affiliates").insert({
      full_name: name,
      email,
      phone: form.phone.trim() || null,
      pix_key: form.pix_key.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSending(false);

    if (insertError) {
      if (insertError.code === "23505") setError("Já existe uma candidatura com este e-mail. Aguarde o retorno ou fale com a gente.");
      else if (/does not exist|schema cache/.test(insertError.message)) setError("O formulário de afiliados ainda está sendo configurado. Tente novamente mais tarde.");
      else setError("Não foi possível enviar agora. Tente de novo em instantes.");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (open === null) return <main className="pf-state">Carregando...</main>;

  if (open === false) {
    return (
      <main className="pf-state">
        <h1>Inscrições fechadas no momento</h1>
        <p>Não estamos aceitando novos pedidos de afiliados agora. Volte a conferir em breve.</p>
        <Link to="/">← Voltar para o site</Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="pf-page">
        <div className="pf-shell">
          <div className="pf-success">
            <h1>Recebemos seu pedido!</h1>
            <p>Vamos analisar e entrar em contato pelo e-mail ou WhatsApp que você deixou. Se for aprovado, você recebe o seu link exclusivo.</p>
            <Link to="/">← Voltar para o site</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pf-page">
      <div className="pf-shell">
        <header className="pf-hero">
          <span>Afiliados</span>
          <h1>Seja um afiliado</h1>
          <p>
            Indique os cursos e mentorias do Hanif Alves com o seu link exclusivo e ganhe comissão por cada venda. Preencha o formulário
            abaixo: é rápido, e assim que aprovarmos, você recebe o seu código.
          </p>
        </header>

        <form className="fx fb-form" onSubmit={submit} noValidate>
          <section className="fx-card">
            <h2>Seus dados</h2>
            <div className="fx-id">
              <label><span>Nome completo *</span><input className="fx-input" value={form.name} onChange={set("name")} autoComplete="name" /></label>
              <label><span>E-mail *</span><input className="fx-input" type="email" value={form.email} onChange={set("email")} autoComplete="email" /></label>
              <label><span>WhatsApp (opcional)</span><input className="fx-input" value={form.phone} onChange={set("phone")} placeholder="(00) 00000-0000" autoComplete="tel" /></label>
            </div>
            <label className="fb-label">
              <span>Chave Pix (opcional)</span>
              <input className="fx-input" value={form.pix_key} onChange={set("pix_key")} placeholder="Pode preencher depois, se preferir" />
              <small className="fx-hint">É para onde a sua comissão é paga, depois de aprovado. Pagamentos são feitos por fora, manualmente.</small>
            </label>
            <label className="fb-label">
              <span>Conte um pouco: onde você pretende divulgar? (opcional)</span>
              <textarea className="fx-input" rows={3} value={form.notes} onChange={set("notes")} maxLength={800} placeholder="Ex.: Instagram de enfermagem, grupo de WhatsApp da turma..." />
            </label>
          </section>

          {/* campo escondido: só robôs preenchem */}
          <div className="fb-trap" aria-hidden="true">
            <label>Site<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label>
          </div>

          {error && <div className="fx-error" role="alert">{error}</div>}
          <button className="fx-submit" type="submit" disabled={sending}>{sending ? "Enviando..." : "Quero ser afiliado"}</button>
        </form>
      </div>
    </main>
  );
}
