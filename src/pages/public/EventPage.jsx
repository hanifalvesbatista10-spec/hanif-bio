import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import {
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  LEGACY_EVENT,
  LEGACY_SLUG,
  cleanOrigin,
  isRegistrationOpen,
  withDefaults,
} from "../../services/events";
import "../../styles/event-page.css";

const initialForm = { full_name: "", whatsapp: "", email: "", city: "", occupation: "", aph_experience: "", main_goal: "" };

// *trecho* vira destaque em vermelho.
function Highlight({ text }) {
  return String(text || "")
    .split(/\*([^*]+)\*/)
    .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>));
}

function isMissingTable(error) {
  const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return text.includes("events") && (text.includes("does not exist") || text.includes("pgrst205") || text.includes("42p01"));
}

export default function EventPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const source = cleanOrigin(searchParams.get("origem"));

  const [event, setEvent] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | notfound
  const [form, setForm] = useState(initialForm);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setState("loading");
    supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError && isMissingTable(loadError) && slug === LEGACY_SLUG) {
          // Migration 15 ainda não executada: o evento original segue funcionando.
          setEvent(withDefaults(LEGACY_EVENT));
          setState("ready");
        } else if (data) {
          setEvent(withDefaults(data));
          setState("ready");
        } else {
          setState("notfound");
        }
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!event) return undefined;
    const previous = document.title;
    document.title = `${event.title} | Hanif Alves`;
    return () => {
      document.title = previous;
    };
  }, [event]);

  // Rascunho: só o admin enxerga (RLS). Mostra a página completa como pré-visualização.
  const preview = event?.status === "draft";
  const open = event ? isRegistrationOpen(event) || preview : false;
  const canSubmit = useMemo(() => form.full_name.trim() && form.whatsapp.trim() && form.email.trim(), [form]);
  const set = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || sending || !event) return;

    setSending(true);
    setError("");

    const { error: insertError } = await supabase.from("event_registrations").insert({
      event_slug: event.slug,
      full_name: form.full_name.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim().toLowerCase(),
      city: event.ask_fields.city ? form.city.trim() || null : null,
      occupation: event.ask_fields.occupation ? form.occupation.trim() || null : null,
      aph_experience: event.ask_fields.aph_experience ? form.aph_experience || null : null,
      main_goal: event.ask_fields.main_goal ? form.main_goal || null : null,
      source,
    });

    setSending(false);

    if (insertError) {
      console.error(insertError);
      if (insertError.code === "23505") setError("Este e-mail já está inscrito neste evento. Fique tranquilo(a): sua vaga está garantida.");
      else if (insertError.code === "42501") setError("As inscrições deste evento foram encerradas ou as vagas acabaram.");
      else setError("Não foi possível concluir sua inscrição agora. Tente novamente em instantes.");
      return;
    }

    setSuccess(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (state === "loading") {
    return <div className="event-page"><div className="event-status">Carregando evento...</div></div>;
  }

  if (state === "notfound") {
    return (
      <div className="event-page">
        <div className="event-status">
          <h1>Evento não encontrado</h1>
          <p>Este link pode estar incorreto ou o evento ainda não foi publicado.</p>
          <Link className="event-back-btn" to="/">Voltar para o site</Link>
        </div>
      </div>
    );
  }

  const info = event.info.filter((item) => item.title || item.text);
  const topics = event.topics.filter((item) => item.title || item.text);

  return (
    <div className="event-page">
      {success ? (
        <section className="event-success">
          <div className="success-box">
            <div className="success-icon">✓</div>
            <h1>{event.success_title}</h1>
            <p>{event.success_message}</p>
            {event.whatsapp_group_url && (
              <a className="success-btn" href={event.whatsapp_group_url} target="_blank" rel="noreferrer">ENTRAR NO GRUPO OFICIAL</a>
            )}
            <Link className="success-secondary" to="/">Voltar para o site</Link>
          </div>
        </section>
      ) : (
        <>
          {preview && (
            <div className="event-preview-note" role="status">
              Pré-visualização: este evento ainda é um rascunho e só você vê esta página. Publique no painel para abrir as inscrições.
            </div>
          )}
          <header className="event-top">
            <div className="event-container event-top-inner">
              <div className="event-brand">HANIF ALVES<span>APH • URGÊNCIA • EMERGÊNCIA</span></div>
              <Link className="event-back" to="/">← Voltar ao site</Link>
            </div>
          </header>

          <main>
            <section className="event-hero">
              <div className="event-container event-hero-inner">
                {event.kicker && <div className="brush">{event.kicker}</div>}
                {event.headline && <div className="city">{event.headline}</div>}
                {event.subtitle && <div className="course"><Highlight text={event.subtitle} /></div>}
                {event.tags.length > 0 && (
                  <div className="hero-tags">{event.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                )}
                {info.length > 0 && (
                  <div className="hero-info">
                    {info.map((item, index) => (
                      <div key={index}><b>{item.title}</b><span>{item.text}</span></div>
                    ))}
                  </div>
                )}
                {open ? (
                  <a className="hero-cta" href="#inscricao">{event.cta_label}</a>
                ) : (
                  <div className="event-closed" role="status">Inscrições encerradas</div>
                )}
              </div>
            </section>

            <section className="event-section" id="inscricao">
              <div className="event-container event-grid">
                <div className="event-copy">
                  {event.section_title && <h2>{event.section_title}</h2>}
                  {event.description && <p>{event.description}</p>}
                  {topics.length > 0 && (
                    <div className="event-topics">
                      {topics.map((topic, index) => (
                        <div className="event-topic" key={index}><b>{topic.title}</b><span>{topic.text}</span></div>
                      ))}
                    </div>
                  )}
                </div>

                {open ? (
                  <form className="event-form" onSubmit={submit}>
                    <h3>{event.form_title}</h3>
                    <p>{event.form_intro}</p>
                    <div className="event-fields">
                      <div className="event-field full"><label htmlFor="ev-name">Nome completo *</label><input id="ev-name" required value={form.full_name} onChange={set("full_name")} placeholder="Seu nome completo" autoComplete="name" /></div>
                      <div className="event-field"><label htmlFor="ev-wa">WhatsApp *</label><input id="ev-wa" required value={form.whatsapp} onChange={set("whatsapp")} placeholder="(88) 99999-9999" inputMode="tel" autoComplete="tel" /></div>
                      <div className="event-field"><label htmlFor="ev-mail">E-mail *</label><input id="ev-mail" required type="email" value={form.email} onChange={set("email")} placeholder="voce@email.com" autoComplete="email" /></div>
                      {event.ask_fields.city && (
                        <div className="event-field"><label htmlFor="ev-city">Cidade</label><input id="ev-city" value={form.city} onChange={set("city")} placeholder="Sua cidade" /></div>
                      )}
                      {event.ask_fields.occupation && (
                        <div className="event-field"><label htmlFor="ev-job">Profissão / ocupação</label><input id="ev-job" value={form.occupation} onChange={set("occupation")} placeholder="Ex.: técnico, estudante..." /></div>
                      )}
                      {event.ask_fields.aph_experience && (
                        <div className="event-field"><label htmlFor="ev-exp">Contato com o APH</label>
                          <select id="ev-exp" value={form.aph_experience} onChange={set("aph_experience")}>
                            <option value="">Selecione</option>
                            {EXPERIENCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                      )}
                      {event.ask_fields.main_goal && (
                        <div className="event-field"><label htmlFor="ev-goal">Principal objetivo</label>
                          <select id="ev-goal" value={form.main_goal} onChange={set("main_goal")}>
                            <option value="">Selecione</option>
                            {GOAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <button className="event-submit" type="submit" disabled={!canSubmit || sending}>{sending ? "CONFIRMANDO..." : "CONFIRMAR MINHA INSCRIÇÃO"}</button>
                    {error && <div className="event-error" role="alert">{error}</div>}
                    <p className="event-note">Seus dados serão usados para administrar sua inscrição e comunicar informações relacionadas a este evento.</p>
                  </form>
                ) : (
                  <div className="event-form event-form-closed">
                    <h3>Inscrições encerradas</h3>
                    <p>Este evento não está recebendo novas inscrições no momento. Acompanhe o site e as redes para os próximos.</p>
                    <Link className="event-back-btn" to="/">Ver o site</Link>
                  </div>
                )}
              </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}
