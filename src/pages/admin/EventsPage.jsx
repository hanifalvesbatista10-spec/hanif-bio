import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { STATUS_LABELS, eventUrl, slugify } from "../../services/events";

export function isMissingEventsTable(error) {
  const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return text.includes("events") && (text.includes("does not exist") || text.includes("pgrst205") || text.includes("42p01"));
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [busyId, setBusyId] = useState(null);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    const [eventsResult, regsResult] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }),
      supabase.from("event_registrations").select("event_slug"),
    ]);
    if (eventsResult.error) {
      if (isMissingEventsTable(eventsResult.error)) setMissingTable(true);
      else notify("error", `Erro ao carregar: ${eventsResult.error.message}`);
      setEvents([]);
    } else {
      setMissingTable(false);
      setEvents(eventsResult.data || []);
    }
    setRegistrations(regsResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const map = {};
    registrations.forEach((row) => {
      map[row.event_slug] = (map[row.event_slug] || 0) + 1;
    });
    return map;
  }, [registrations]);

  const copyLink = async (event) => {
    const ok = await copyToClipboard(eventUrl(event.slug));
    notify(ok ? "success" : "error", ok ? `Link de “${event.title}” copiado.` : "Não consegui copiar. Selecione o link e copie manualmente.");
  };

  const setStatus = async (event, status) => {
    setBusyId(event.id);
    const { data, error } = await supabase.from("events").update({ status }).eq("id", event.id).select("*").single();
    if (error) notify("error", `Erro: ${error.message}`);
    else {
      setEvents((current) => current.map((item) => (item.id === event.id ? data : item)));
      notify("success", status === "published" ? `Inscrições de “${event.title}” abertas.` : status === "closed" ? `“${event.title}” encerrado. A página avisa que as inscrições acabaram.` : "Evento voltou para rascunho.");
    }
    setBusyId(null);
  };

  const duplicate = async (event) => {
    setBusyId(event.id);
    const { id, created_at, updated_at, slug, title, ...rest } = event;
    let candidate = `${slug}-copia`;
    let n = 2;
    while (events.some((item) => item.slug === candidate)) candidate = `${slug}-copia-${n++}`;
    const { data, error } = await supabase
      .from("events")
      .insert({ ...rest, title: `${title} (cópia)`, slug: slugify(candidate), status: "draft" })
      .select("*")
      .single();
    if (error) notify("error", `Erro ao duplicar: ${error.message}`);
    else {
      setEvents((current) => [data, ...current]);
      notify("success", "Cópia criada como rascunho. Abra para ajustar data, texto e link.");
    }
    setBusyId(null);
  };

  const remove = async (event) => {
    if ((counts[event.slug] || 0) > 0) {
      notify("error", `“${event.title}” tem ${counts[event.slug]} inscrito(s). Para não perder esses dados, encerre o evento em vez de excluir (ou exporte e apague os inscritos antes).`);
      return;
    }
    if (!window.confirm(`Excluir o evento “${event.title}”? O link deixará de funcionar.`)) return;
    setBusyId(event.id);
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) notify("error", `Erro ao excluir: ${error.message}`);
    else {
      setEvents((current) => current.filter((item) => item.id !== event.id));
      notify("success", "Evento excluído.");
    }
    setBusyId(null);
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ENGAJAMENTO</span>
          <h2>Eventos e inscrições</h2>
        </div>
        {!missingTable && <Link className="admin-button primary" to="/admin/eventos/novo">+ Novo evento</Link>}
      </div>

      <p className="adm-lead">
        Cada evento tem o próprio link de inscrição e os próprios resultados. Crie, copie o link, divulgue e acompanhe os inscritos aqui.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      {missingTable ? (
        <div className="admin-alert error">
          O banco ainda não tem a tabela de eventos. Execute <strong>supabase/15_eventos.sql</strong> no SQL Editor do
          Supabase e recarregue. Enquanto isso, o Aulão Barro–CE continua recebendo inscrições normalmente.
        </div>
      ) : loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : events.length === 0 ? (
        <div className="admin-empty">
          Nenhum evento criado ainda.
          <br />
          <Link className="admin-button primary" style={{ marginTop: 14 }} to="/admin/eventos/novo">Criar o primeiro evento</Link>
        </div>
      ) : (
        <ul className="adm-event-list">
          {events.map((event) => {
            const total = counts[event.slug] || 0;
            return (
              <li key={event.id} className={`adm-event ${event.status === "draft" ? "is-draft" : ""}`}>
                <div className="adm-event-main">
                  <div className="adm-event-title">
                    <h3><Link to={`/admin/eventos/${event.id}`}>{event.title}</Link></h3>
                    <span className={`status-badge ${event.status === "published" ? "published" : event.status === "closed" ? "hidden" : "draft"}`}>{STATUS_LABELS[event.status]}</span>
                  </div>
                  <p className="adm-event-link">
                    <code>{eventUrl(event.slug).replace(/^https?:\/\//, "")}</code>
                  </p>
                </div>

                <div className="adm-event-count">
                  <strong>{total}</strong>
                  <span>{event.capacity ? `de ${event.capacity} vagas` : "inscritos"}</span>
                </div>

                <div className="adm-event-actions">
                  <Link className="adm-action is-primary" to={`/admin/eventos/${event.id}`}>Ver inscritos</Link>
                  <button type="button" className="adm-action" onClick={() => copyLink(event)}>Copiar link</button>
                  <a className="adm-action" href={`/evento/${event.slug}`} target="_blank" rel="noreferrer">Abrir página</a>
                  <Link className="adm-action" to={`/admin/eventos/${event.id}?aba=config`}>Editar</Link>
                  {event.status === "published" ? (
                    <button type="button" className="adm-action" disabled={busyId === event.id} onClick={() => setStatus(event, "closed")}>Encerrar inscrições</button>
                  ) : (
                    <button type="button" className="adm-action" disabled={busyId === event.id} onClick={() => setStatus(event, "published")}>{event.status === "closed" ? "Reabrir inscrições" : "Publicar"}</button>
                  )}
                  <button type="button" className="adm-action" disabled={busyId === event.id} onClick={() => duplicate(event)}>Duplicar</button>
                  <button type="button" className="adm-action is-danger" disabled={busyId === event.id} onClick={() => remove(event)}>Excluir</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
