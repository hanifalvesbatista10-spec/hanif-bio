import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";

const WHATSAPP_GROUP = "https://chat.whatsapp.com/H8wFKHIVebYIH2tOU80wNU?s=cl&p=a&mlu=4&ilr=4";
const EVENT_SLUG = "aulao-aph-barro-2026";

const initialForm = {
  full_name: "",
  whatsapp: "",
  email: "",
  city: "",
  occupation: "",
  aph_experience: "",
  main_goal: "",
};

export default function EventBarroPage() {
  const [form, setForm] = useState(initialForm);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(
    () => form.full_name.trim() && form.whatsapp.trim() && form.email.trim(),
    [form]
  );

  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || sending) return;

    setSending(true);
    setError("");

    const { error: insertError } = await supabase.from("event_registrations").insert({
      event_slug: EVENT_SLUG,
      full_name: form.full_name.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim().toLowerCase(),
      city: form.city.trim() || null,
      occupation: form.occupation.trim() || null,
      aph_experience: form.aph_experience || null,
      main_goal: form.main_goal || null,
      source: "bio",
    });

    setSending(false);

    if (insertError) {
      console.error(insertError);
      setError("Não foi possível concluir sua inscrição agora. Tente novamente em instantes.");
      return;
    }

    setSuccess(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="event-page">
      <style>{`
        :root{--navy:#071426;--navy2:#0d2238;--red:#d6152d;--cream:#f4f7fa;--text:#52677b}
        *{box-sizing:border-box}.event-page{min-height:100vh;background:#fff;color:var(--navy);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.event-container{width:min(1120px,calc(100% - 32px));margin:0 auto}.event-top{background:#050d17;color:#fff}.event-top-inner{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px}.event-brand{font-weight:950;letter-spacing:.03em}.event-brand span{display:block;color:#9badbd;font-size:.62rem;letter-spacing:.15em;margin-top:3px}.event-back{color:#d7e0e8;text-decoration:none;font-size:.84rem;font-weight:850}.event-hero{position:relative;overflow:hidden;background:radial-gradient(circle at 75% 20%,rgba(214,21,45,.28),transparent 28%),linear-gradient(135deg,#071426,#0d2238);color:#fff;padding:72px 0 64px}.event-hero:after{content:"";position:absolute;right:-140px;bottom:-180px;width:460px;height:460px;border-radius:50%;border:80px solid rgba(255,255,255,.025)}.event-hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:1.18fr .82fr;gap:54px;align-items:center}.event-badge{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:.72rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.event-hero h1{margin:16px 0 18px;line-height:.82;letter-spacing:-.07em;text-transform:uppercase}.event-hero h1 span{display:block;font-size:clamp(2rem,4vw,4.1rem);line-height:.95;letter-spacing:-.045em;color:#fff;margin-bottom:8px}.event-hero h1 em{display:block;font-size:clamp(5.4rem,11vw,10.4rem);line-height:.78;color:#ff304b;font-style:normal;text-shadow:0 18px 44px rgba(0,0,0,.32)}.event-course-line{font-size:clamp(1.2rem,2.15vw,1.9rem);font-weight:950;line-height:1.15;letter-spacing:-.02em;margin:0 0 12px;color:#fff}.event-lead{max-width:720px;color:#c6d2dd;line-height:1.7;font-size:1.05rem}.event-pills{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.event-pill{padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-weight:850;font-size:.82rem}.event-card{background:#fff;color:var(--navy);padding:28px;border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.28)}.event-card strong{display:block;font-size:1.35rem;margin-bottom:8px}.event-card p{margin:0;color:var(--text);line-height:1.6}.event-free{margin-top:20px;padding:18px;border-radius:16px;background:#f6f8fa;border:1px solid #e1e7ec}.event-free b{font-size:1.7rem;color:var(--red)}.event-section{padding:76px 0}.event-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:48px;align-items:start}.event-copy h2{font-size:clamp(2.2rem,4vw,3.7rem);line-height:1;letter-spacing:-.045em;margin:0 0 16px}.event-copy p{color:var(--text);line-height:1.75}.event-topics{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:26px}.event-topic{padding:18px;border-radius:16px;background:var(--cream);border:1px solid #e2e8ed}.event-topic b{display:block;margin-bottom:7px}.event-form{padding:30px;border-radius:22px;border:1px solid #e1e6eb;box-shadow:0 20px 60px rgba(7,20,38,.09)}.event-form h3{font-size:1.6rem;margin:0 0 5px}.event-form>p{margin:0 0 22px;color:var(--text)}.event-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.event-field{display:grid;gap:7px}.event-field.full{grid-column:1/-1}.event-field label{font-size:.78rem;font-weight:900;color:#284158}.event-field input,.event-field select{width:100%;min-height:49px;border:1px solid #ccd6df;border-radius:11px;padding:0 13px;background:#fff;color:#0b1a29;font:inherit;outline:none}.event-field input:focus,.event-field select:focus{border-color:#d6152d;box-shadow:0 0 0 3px rgba(214,21,45,.08)}.event-submit{margin-top:18px;width:100%;min-height:56px;border:0;border-radius:12px;background:var(--red);color:#fff;font-weight:950;font-size:1rem;cursor:pointer;box-shadow:0 14px 34px rgba(214,21,45,.22)}.event-submit:disabled{opacity:.55;cursor:not-allowed}.event-note{margin-top:11px!important;font-size:.75rem!important;color:#758697!important}.event-error{margin-top:14px;padding:12px;border-radius:10px;background:#fff1f2;color:#9f1023;font-weight:800;font-size:.84rem}.event-success{min-height:100vh;background:linear-gradient(135deg,#071426,#0d2238);color:#fff;display:flex;align-items:center;padding:40px 0}.success-box{width:min(680px,calc(100% - 32px));margin:auto;text-align:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.11);border-radius:26px;padding:42px}.success-icon{width:68px;height:68px;margin:0 auto 18px;border-radius:50%;display:grid;place-items:center;background:#17a45b;font-size:2rem}.success-box h1{font-size:clamp(2.4rem,6vw,4.2rem);line-height:1;margin:0 0 14px}.success-box p{color:#c8d4df;line-height:1.7}.success-btn{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 24px;margin-top:18px;border-radius:12px;background:#1da851;color:#fff;text-decoration:none;font-weight:950}.success-secondary{display:block;margin-top:18px;color:#b9c6d2;text-decoration:none;font-size:.84rem}
        @media(max-width:840px){.event-hero-grid,.event-grid{grid-template-columns:1fr}.event-hero{padding:48px 0}.event-hero h1 span{font-size:2rem}.event-hero h1 em{font-size:clamp(4.8rem,22vw,7.2rem)}.event-course-line{font-size:1.25rem}.event-fields,.event-topics{grid-template-columns:1fr}.event-card{margin-top:6px}} 
      `}</style>

      {success ? (
        <section className="event-success">
          <div className="success-box">
            <div className="success-icon">✓</div>
            <h1>Inscrição confirmada.</h1>
            <p>
              Você está inscrito no Aulão Intensivo de Atendimento Pré-Hospitalar — Clínico + Trauma, em Barro–CE.
              Entre agora no grupo oficial para receber data, local e orientações do evento.
            </p>
            <a className="success-btn" href={WHATSAPP_GROUP} target="_blank" rel="noreferrer">
              ENTRAR NO GRUPO OFICIAL
            </a>
            <Link className="success-secondary" to="/">Voltar para o site</Link>
          </div>
        </section>
      ) : (
        <>
          <header className="event-top">
            <div className="event-container event-top-inner">
              <div className="event-brand">HANIF ALVES<span>APH • URGÊNCIA • EMERGÊNCIA</span></div>
              <Link className="event-back" to="/">← Voltar ao site</Link>
            </div>
          </header>

          <main>
            <section className="event-hero">
              <div className="event-container event-hero-grid">
                <div>
                  <span className="event-badge">EVENTO PRESENCIAL • VAGAS LIMITADAS</span>
                  <h1><span>AULÃO GRATUITO EM</span><em>BARRO–CE</em></h1>
                  <p className="event-course-line">CURSO INTENSIVO DE ATENDIMENTO PRÉ-HOSPITALAR</p>
                  <p className="event-lead">
                    Atualização intensiva em APH com foco em emergências clínicas e trauma. Conteúdo direto,
                    raciocínio aplicado e prioridades que fazem diferença no atendimento.
                  </p>
                  <div className="event-pills">
                    <span className="event-pill">CLÍNICO + TRAUMA</span>
                    <span className="event-pill">PRESENCIAL</span>
                    <span className="event-pill">100% GRATUITO</span>
                  </div>
                </div>
                <aside className="event-card">
                  <strong>Curso Intensivo de APH</strong>
                  <p>Inscrição oficial para participar do aulão em Barro, Ceará.</p>
                  <div className="event-free"><span>INVESTIMENTO</span><b> GRATUITO</b></div>
                </aside>
              </div>
            </section>

            <section className="event-section">
              <div className="event-container event-grid">
                <div className="event-copy">
                  <h2>Atualização para quem quer decidir melhor no APH.</h2>
                  <p>
                    O aulão foi pensado para profissionais, estudantes e interessados em atendimento pré-hospitalar que desejam revisar conceitos e fortalecer a tomada de decisão diante de situações clínicas e traumáticas.
                  </p>
                  <div className="event-topics">
                    <div className="event-topic"><b>Atendimento clínico</b><span>Reconhecimento, avaliação e prioridades iniciais.</span></div>
                    <div className="event-topic"><b>Atendimento ao trauma</b><span>Abordagem, prioridades e tomada de decisão.</span></div>
                    <div className="event-topic"><b>Conteúdo aplicado</b><span>Foco na realidade do atendimento pré-hospitalar.</span></div>
                    <div className="event-topic"><b>Barro–CE</b><span>Data e local serão divulgados aos inscritos.</span></div>
                  </div>
                </div>

                <form className="event-form" onSubmit={submit}>
                  <h3>Faça sua inscrição gratuita</h3>
                  <p>Preencha seus dados para garantir sua inscrição e receber as próximas informações.</p>
                  <div className="event-fields">
                    <div className="event-field full"><label>Nome completo *</label><input required value={form.full_name} onChange={set("full_name")} placeholder="Seu nome completo" /></div>
                    <div className="event-field"><label>WhatsApp *</label><input required value={form.whatsapp} onChange={set("whatsapp")} placeholder="(88) 99999-9999" inputMode="tel" /></div>
                    <div className="event-field"><label>E-mail *</label><input required type="email" value={form.email} onChange={set("email")} placeholder="voce@email.com" /></div>
                    <div className="event-field"><label>Cidade</label><input value={form.city} onChange={set("city")} placeholder="Sua cidade" /></div>
                    <div className="event-field"><label>Profissão / ocupação</label><input value={form.occupation} onChange={set("occupation")} placeholder="Ex.: técnico, estudante..." /></div>
                    <div className="event-field"><label>Contato com o APH</label><select value={form.aph_experience} onChange={set("aph_experience")}><option value="">Selecione</option><option value="iniciante">Estou começando</option><option value="estudante">Sou estudante</option><option value="profissional">Já atuo na área</option><option value="experiente">Tenho experiência em APH</option></select></div>
                    <div className="event-field"><label>Principal objetivo</label><select value={form.main_goal} onChange={set("main_goal")}><option value="">Selecione</option><option value="atualizacao">Atualização profissional</option><option value="samu">Trabalhar no SAMU</option><option value="provas">Provas e processos seletivos</option><option value="pratica">Melhorar minha prática no APH</option><option value="conhecimento">Ampliar conhecimentos</option></select></div>
                  </div>
                  <button className="event-submit" type="submit" disabled={!canSubmit || sending}>{sending ? "CONFIRMANDO..." : "CONFIRMAR MINHA INSCRIÇÃO"}</button>
                  {error && <div className="event-error">{error}</div>}
                  <p className="event-note">Seus dados serão usados para administrar sua inscrição e comunicar informações relacionadas a este evento.</p>
                </form>
              </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}
