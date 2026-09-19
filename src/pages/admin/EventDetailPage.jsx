import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import {
  ASK_FIELDS,
  EMPTY_EVENT,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  ORIGINS,
  SLUG_PATTERN,
  STATUS_LABELS,
  eventUrl,
  labelFor,
  slugify,
  toCsv,
  withDefaults,
} from "../../services/events";
import { copyToClipboard, isMissingEventsTable } from "./EventsPage";

function toLocalInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function padList(list, size) {
  const copy = list.slice(0, size);
  while (copy.length < size) copy.push({ title: "", text: "" });
  return copy;
}

export default function EventDetailPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = isNew ? "config" : params.get("aba") === "config" ? "config" : "results";

  const [form, setForm] = useState(() => withDefaults(EMPTY_EVENT));
  const [slugTouched, setSlugTouched] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [missingTable, setMissingTable] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [origin, setOrigin] = useState("");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    if (isNew) return;
    const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissingEventsTable(error)) setMissingTable(true);
      else notify("error", `Erro ao carregar: ${error.message}`);
      setLoading(false);
      return;
    }
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setForm(withDefaults(data));
    setSlugTouched(true);
    const regs = await supabase
      .from("event_registrations")
      .select("*")
      .eq("event_slug", data.slug)
      .order("created_at", { ascending: false });
    if (regs.error) notify("error", "Não foi possível carregar as inscrições.");
    else setRegistrations(regs.data || []);
    setLoading(false);
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew) load();
    else if (!id) setLoading(false);
  }, [load, isNew, id]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setListItem = (key, index, field, value) =>
    setForm((current) => {
      const list = padList(current[key], key === "info" ? 3 : 4).map((item, i) => (i === index ? { ...item, [field]: value } : item));
      return { ...current, [key]: list };
    });

  const onTitle = (value) => {
    setForm((current) => ({ ...current, title: value, ...(slugTouched ? {} : { slug: slugify(value) }) }));
  };

  const hasRegistrations = registrations.length > 0;
  const link = form.slug ? eventUrl(form.slug, origin) : "";

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return registrations;
    return registrations.filter((row) =>
      [row.full_name, row.whatsapp, row.email, row.city, row.occupation, row.main_goal, row.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [registrations, query]);

  const byOrigin = useMemo(() => {
    const map = {};
    registrations.forEach((row) => {
      const key = row.source || "—";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [registrations]);

  const save = async (event) => {
    event.preventDefault();
    const slug = form.slug.trim();
    if (!form.title.trim()) return notify("error", "Dê um nome ao evento.");
    if (!SLUG_PATTERN.test(slug)) return notify("error", "O endereço do link só pode ter letras minúsculas, números e hífens (ex.: aulao-fortaleza-2026).");

    const payload = {
      slug,
      title: form.title.trim(),
      kicker: form.kicker?.trim() || null,
      headline: form.headline?.trim() || null,
      subtitle: form.subtitle?.trim() || null,
      tags: form.tags.map((tag) => tag.trim()).filter(Boolean),
      info: padList(form.info, 3).filter((item) => item.title.trim() || item.text.trim()),
      section_title: form.section_title?.trim() || null,
      description: form.description?.trim() || null,
      topics: padList(form.topics, 4).filter((item) => item.title.trim() || item.text.trim()),
      form_title: form.form_title?.trim() || null,
      form_intro: form.form_intro?.trim() || null,
      cta_label: form.cta_label?.trim() || null,
      ask_fields: form.ask_fields,
      success_title: form.success_title?.trim() || null,
      success_message: form.success_message?.trim() || null,
      whatsapp_group_url: form.whatsapp_group_url?.trim() || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      registration_deadline: form.registration_deadline ? new Date(form.registration_deadline).toISOString() : null,
      status: form.status,
    };

    setSaving(true);
    setMessage("");
    const result = isNew
      ? await supabase.from("events").insert(payload).select("*").single()
      : await supabase.from("events").update(payload).eq("id", id).select("*").single();
    setSaving(false);

    if (result.error) {
      notify(
        "error",
        result.error.code === "23505"
          ? "Já existe um evento com este endereço de link. Escolha outro."
          : isMissingEventsTable(result.error)
            ? "O banco ainda não tem a tabela de eventos. Execute supabase/15_eventos.sql no SQL Editor."
            : `Erro ao salvar: ${result.error.message}`
      );
      return;
    }

    if (isNew) {
      navigate(`/admin/eventos/${result.data.id}`, { replace: true, state: { created: true } });
    } else {
      setForm(withDefaults(result.data));
      notify("success", "Evento salvo.");
    }
  };

  const copyLink = async () => {
    const ok = await copyToClipboard(link);
    notify(ok ? "success" : "error", ok ? "Link copiado. É só colar na bio, no story ou no WhatsApp." : "Não consegui copiar. Selecione o link e copie manualmente.");
  };

  const exportCsv = () => {
    const blob = new Blob(["﻿", toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inscricoes-${form.slug}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const deleteLead = async (row) => {
    if (!window.confirm(`Excluir definitivamente a inscrição de ${row.full_name}?\n\nEssa ação não pode ser desfeita.`)) return;
    setDeletingId(row.id);
    const { error } = await supabase.from("event_registrations").delete().eq("id", row.id).eq("event_slug", form.slug);
    if (error) notify("error", "Não foi possível excluir esta inscrição. Verifique as permissões e tente novamente.");
    else setRegistrations((current) => current.filter((item) => item.id !== row.id));
    setDeletingId(null);
  };

  if (missingTable) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">
          O banco ainda não tem a tabela de eventos. Execute <strong>supabase/15_eventos.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
        <Link className="admin-button" to="/admin/eventos">← Voltar</Link>
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="admin-section">
        <div className="admin-empty">Evento não encontrado.</div>
        <Link className="admin-button" to="/admin/eventos">← Voltar aos eventos</Link>
      </section>
    );
  }

  const created = Boolean(location.state?.created);
  const total = registrations.length;
  const spotsLeft = form.capacity ? Math.max(Number(form.capacity) - total, 0) : null;

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span><Link to="/admin/eventos" className="adm-crumb">← EVENTOS</Link></span>
          <h2>{isNew ? "Novo evento" : form.title}</h2>
        </div>
        {!isNew && <span className={`status-badge ${form.status === "published" ? "published" : form.status === "closed" ? "hidden" : "draft"}`}>{STATUS_LABELS[form.status]}</span>}
      </div>

      {created && !message && (
        <div className="admin-alert" role="status">Evento criado! Copie o link abaixo para divulgar. Rascunhos só aparecem para você: mude o status para “Inscrições abertas” quando estiver pronto.</div>
      )}
      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      {form.slug && (
        <div className="adm-linkbox">
          <div className="adm-linkbox-main">
            <label htmlFor="ev-origin">Link de inscrição</label>
            <div className="adm-linkbox-row">
              <input id="ev-link" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link de inscrição do evento" />
              <button type="button" className="admin-button primary" onClick={copyLink}>Copiar link</button>
              {!isNew && <a className="admin-button" href={`/evento/${form.slug}`} target="_blank" rel="noreferrer">Abrir página</a>}
            </div>
          </div>
          <label className="adm-linkbox-origin" htmlFor="ev-origin">
            Onde vou divulgar
            <select id="ev-origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              {ORIGINS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <small>Cada origem gera um link com marcação; nos resultados você vê de onde vieram as inscrições.</small>
          </label>
        </div>
      )}

      {!isNew && (
        <div className="adm-segment adm-tabs" role="tablist" aria-label="Seções do evento">
          <button type="button" role="tab" aria-selected={tab === "results"} className={tab === "results" ? "is-active" : ""} onClick={() => setParams({}, { replace: true })}>
            Inscritos <span className="adm-count is-neutral">{total}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "config"} className={tab === "config" ? "is-active" : ""} onClick={() => setParams({ aba: "config" }, { replace: true })}>
            Configurar evento
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : tab === "results" ? (
        <>
          <div className="adm-stats is-four">
            <article className="adm-stat"><div><span>Inscritos</span><strong>{total}</strong></div></article>
            <article className="adm-stat"><div><span>Vagas restantes</span><strong>{spotsLeft ?? "∞"}</strong></div></article>
            <article className="adm-stat"><div><span>Hoje</span><strong>{registrations.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length}</strong></div></article>
            <article className="adm-stat"><div><span>Maior origem</span><strong className="adm-stat-text">{byOrigin[0] ? `${byOrigin[0][0]} (${byOrigin[0][1]})` : "—"}</strong></div></article>
          </div>

          {byOrigin.length > 1 && (
            <p className="adm-origins">
              {byOrigin.map(([key, count]) => <span key={key}>{key}: <strong>{count}</strong></span>)}
            </p>
          )}

          <div className="adm-controls is-registrations">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, cidade, origem..." aria-label="Buscar inscritos" />
            <button type="button" className="admin-button" onClick={exportCsv} disabled={filtered.length === 0}>Exportar CSV</button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table adm-reg-table">
              <thead>
                <tr>
                  <th>Inscrito</th><th>WhatsApp</th><th>Cidade</th><th>Profissão</th><th>Experiência</th><th>Objetivo</th><th>Origem</th><th>Data</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="9" className="adm-table-empty">{total === 0 ? "Ainda não há inscritos. Copie o link acima e divulgue." : "Nenhum inscrito encontrado para a busca."}</td></tr>
                ) : filtered.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.full_name}</strong><small>{row.email}</small></td>
                    <td>{row.whatsapp}</td>
                    <td>{row.city || "—"}</td>
                    <td>{row.occupation || "—"}</td>
                    <td>{row.aph_experience ? labelFor(EXPERIENCE_OPTIONS, row.aph_experience) : "—"}</td>
                    <td>{row.main_goal ? labelFor(GOAL_OPTIONS, row.main_goal) : "—"}</td>
                    <td>{row.source || "—"}</td>
                    <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                    <td><button type="button" className="adm-action is-danger" onClick={() => deleteLead(row)} disabled={deletingId === row.id}>{deletingId === row.id ? "Excluindo..." : "Excluir"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <form className="admin-form adm-event-form" onSubmit={save}>
          <fieldset>
            <legend>Básico</legend>
            <div className="form-grid two">
              <label>Nome do evento<input value={form.title} onChange={(e) => onTitle(e.target.value)} placeholder="Ex.: Aulão APH — Fortaleza" required /></label>
              <label>
                Endereço do link
                <input
                  value={form.slug}
                  onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }}
                  readOnly={hasRegistrations}
                  placeholder="aulao-fortaleza-2026"
                  required
                />
                <small>{hasRegistrations ? "Travado: já existem inscritos vinculados a este endereço." : `${typeof window !== "undefined" ? window.location.origin : ""}/evento/${form.slug || "…"}`}</small>
              </label>
            </div>
            <div className="form-grid three">
              <label>
                Status
                <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="draft">Rascunho (só você vê)</option>
                  <option value="published">Inscrições abertas</option>
                  <option value="closed">Encerrado</option>
                </select>
              </label>
              <label>Limite de vagas (opcional)<input type="number" min="1" value={form.capacity ?? ""} onChange={(e) => set("capacity", e.target.value)} placeholder="Sem limite" /></label>
              <label>Inscrições até (opcional)<input type="datetime-local" value={toLocalInput(form.registration_deadline)} onChange={(e) => set("registration_deadline", e.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Topo da página</legend>
            <div className="form-grid two">
              <label>Faixa vermelha<input value={form.kicker || ""} onChange={(e) => set("kicker", e.target.value)} placeholder="AULÃO GRATUITO EM" /></label>
              <label>Destaque grande (cidade ou tema)<input value={form.headline || ""} onChange={(e) => set("headline", e.target.value)} placeholder="FORTALEZA–CE" /></label>
            </div>
            <label>Subtítulo <small>(use *asteriscos* para pôr um trecho em vermelho)</small><input value={form.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} placeholder="CURSO INTENSIVO DE *ATENDIMENTO PRÉ-HOSPITALAR*" /></label>
            <label>Etiquetas <small>(separe por vírgula)</small><input value={form.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(","))} placeholder="CLÍNICO, TRAUMA, 100% GRATUITO" /></label>
            <div className="adm-pairs">
              <p className="adm-hint">Três cartões de informação (data, local, vagas…):</p>
              {padList(form.info, 3).map((item, index) => (
                <div className="form-grid two" key={index}>
                  <label>Título {index + 1}<input value={item.title} onChange={(e) => setListItem("info", index, "title", e.target.value)} placeholder={["25 DE OUTUBRO", "AUDITÓRIO CENTRAL", "VAGAS LIMITADAS"][index]} /></label>
                  <label>Texto {index + 1}<input value={item.text} onChange={(e) => setListItem("info", index, "text", e.target.value)} placeholder="Detalhe curto" /></label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Conteúdo</legend>
            <label>Título da seção<input value={form.section_title || ""} onChange={(e) => set("section_title", e.target.value)} placeholder="O que você vai aprender" /></label>
            <label>Descrição<textarea rows={3} value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></label>
            <div className="adm-pairs">
              <p className="adm-hint">Até quatro tópicos:</p>
              {padList(form.topics, 4).map((item, index) => (
                <div className="form-grid two" key={index}>
                  <label>Tópico {index + 1}<input value={item.title} onChange={(e) => setListItem("topics", index, "title", e.target.value)} /></label>
                  <label>Descrição do tópico {index + 1}<input value={item.text} onChange={(e) => setListItem("topics", index, "text", e.target.value)} /></label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Formulário de inscrição</legend>
            <div className="form-grid two">
              <label>Título do formulário<input value={form.form_title || ""} onChange={(e) => set("form_title", e.target.value)} /></label>
              <label>Texto do botão do topo<input value={form.cta_label || ""} onChange={(e) => set("cta_label", e.target.value)} /></label>
            </div>
            <label>Texto de apoio<textarea rows={2} value={form.form_intro || ""} onChange={(e) => set("form_intro", e.target.value)} /></label>
            <div className="check-grid">
              <p className="adm-hint">Nome, WhatsApp e e-mail são sempre pedidos. Marque o que mais quiser perguntar:</p>
              {ASK_FIELDS.map(([key, label]) => (
                <label className="adm-check-row" key={key}>
                  <input type="checkbox" checked={Boolean(form.ask_fields[key])} onChange={(e) => set("ask_fields", { ...form.ask_fields, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Depois da inscrição</legend>
            <label>Título da confirmação<input value={form.success_title || ""} onChange={(e) => set("success_title", e.target.value)} /></label>
            <label>Mensagem<textarea rows={3} value={form.success_message || ""} onChange={(e) => set("success_message", e.target.value)} /></label>
            <label>Link do grupo de WhatsApp (opcional)<input type="url" value={form.whatsapp_group_url || ""} onChange={(e) => set("whatsapp_group_url", e.target.value)} placeholder="https://chat.whatsapp.com/..." /></label>
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : isNew ? "Criar evento e gerar link" : "Salvar evento"}</button>
            <Link className="admin-button adm-ghost-link" to="/admin/eventos">Cancelar</Link>
          </div>
        </form>
      )}
    </section>
  );
}
