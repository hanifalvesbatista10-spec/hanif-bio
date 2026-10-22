import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { meetingLive, meetingWindow } from "../../services/meeting";

const emptyForm = { product_id: "", title: "", description: "", starts_at: "", duration_minutes: 90, meet_url: "" };

const isHttps = (value) => /^https:\/\/[^\s]+$/i.test(value);

// <input type="datetime-local"> trabalha no horário do aparelho, o banco guarda em UTC.
const toInputValue = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const when = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function isMissingTable(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("pgrst205") || text.includes("does not exist") || text.includes("schema cache");
}

export default function MeetingsPage() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = async () => {
    const [meetingsResult, productsResult] = await Promise.all([
      supabase.from("live_meetings").select("*").order("starts_at", { ascending: false }),
      supabase.from("products").select("id,title").order("title", { ascending: true }),
    ]);
    if (meetingsResult.error) {
      if (isMissingTable(meetingsResult.error)) setMissing(true);
      else notify("error", `Não foi possível carregar os encontros: ${meetingsResult.error.message}`);
    } else {
      setMeetings(meetingsResult.data || []);
    }
    setProducts(productsResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const titleOf = (id) => products.find((product) => product.id === id)?.title || "Produto";
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.product_id) return notify("error", "Escolha o produto do encontro.");
    if (!form.title.trim()) return notify("error", "Informe o título do encontro.");
    if (!form.starts_at) return notify("error", "Informe a data e a hora.");
    const duration = Number(form.duration_minutes);
    if (!Number.isInteger(duration) || duration < 15 || duration > 480) return notify("error", "A duração deve ser de 15 a 480 minutos.");
    const meetUrl = form.meet_url.trim();
    if (meetUrl && !isHttps(meetUrl)) return notify("error", "O link do Meet precisa começar com https:// (copie o endereço completo da reunião).");

    setSaving(true);
    const payload = {
      product_id: form.product_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      duration_minutes: duration,
      meet_url: meetUrl || null,
    };
    const result = editingId
      ? await supabase.from("live_meetings").update(payload).eq("id", editingId)
      : await supabase.from("live_meetings").insert(payload);
    setSaving(false);
    if (result.error) return notify("error", `Não foi possível salvar: ${result.error.message}`);
    notify("success", editingId ? "Encontro atualizado." : "Encontro agendado. Os alunos do produto já o veem no curso.");
    reset();
    load();
  };

  // Reunião na hora: cria o encontro com o horário de agora e já abre a sala como dono. Os alunos do produto
  // veem o botão de entrar no curso (a sala já está dentro da janela de entrada).
  const startNow = async () => {
    if (!form.product_id) return notify("error", "Escolha o produto da reunião.");
    const duration = Number(form.duration_minutes);
    if (!Number.isInteger(duration) || duration < 15 || duration > 480) return notify("error", "A duração deve ser de 15 a 480 minutos.");
    const meetUrl = form.meet_url.trim();
    if (meetUrl && !isHttps(meetUrl)) return notify("error", "O link do Meet precisa começar com https:// (copie o endereço completo da reunião).");

    setStarting(true);
    const { data, error } = await supabase
      .from("live_meetings")
      .insert({
        product_id: form.product_id,
        title: form.title.trim() || "Reunião ao vivo",
        description: form.description.trim() || null,
        starts_at: new Date().toISOString(),
        duration_minutes: duration,
        meet_url: meetUrl || null,
      })
      .select("id")
      .single();
    setStarting(false);
    if (error) return notify("error", `Não foi possível iniciar a reunião: ${error.message}`);
    // com Meet não há sala dentro do site: os alunos já veem "AO VIVO" com o botão do Meet; você abre o seu Meet normalmente
    if (meetUrl) {
      notify("success", "Ao vivo! Os alunos do produto já veem “Entrar no Meet”. Quando terminar, volte aqui e clique em Encerrar agora.");
      reset();
      load();
      return;
    }
    navigate(`/minha-area/encontro/${data.id}`);
  };

  const edit = (meeting) => {
    setEditingId(meeting.id);
    setForm({
      product_id: meeting.product_id,
      title: meeting.title,
      description: meeting.description || "",
      starts_at: toInputValue(meeting.starts_at),
      duration_minutes: meeting.duration_minutes,
      meet_url: meeting.meet_url || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Encerra agora: o aviso "ao vivo" some para os alunos e a janela de presença passa a contar daqui.
  const endNow = async (meeting) => {
    const { error } = await supabase.from("live_meetings").update({ ended_at: new Date().toISOString() }).eq("id", meeting.id);
    if (error) return notify("error", `Não foi possível encerrar: ${error.message}`);
    notify("success", `“${meeting.title}” encerrado. O aviso ao vivo saiu da área dos alunos.`);
    load();
  };

  const extend = async (meeting) => {
    const next = Number(meeting.duration_minutes) + 30;
    if (next > 480) return notify("error", "O encontro já está no limite de 8 horas.");
    const { error } = await supabase.from("live_meetings").update({ duration_minutes: next }).eq("id", meeting.id);
    if (error) return notify("error", `Não foi possível prolongar: ${error.message}`);
    notify("success", `“${meeting.title}” prolongado por mais 30 minutos (agora ${next} min).`);
    load();
  };

  const reopen = async (meeting) => {
    const { error } = await supabase.from("live_meetings").update({ ended_at: null }).eq("id", meeting.id);
    if (error) return notify("error", `Não foi possível reabrir: ${error.message}`);
    notify("success", `“${meeting.title}” reaberto.`);
    load();
  };

  const remove = async (meeting) => {
    if (!window.confirm(`Excluir o encontro "${meeting.title}"?`)) return;
    const { error } = await supabase.from("live_meetings").delete().eq("id", meeting.id);
    if (error) return notify("error", `Não foi possível excluir: ${error.message}`);
    notify("success", "Encontro excluído.");
    if (editingId === meeting.id) reset();
    load();
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">
          O banco ainda não tem os encontros ao vivo. Execute <strong>supabase/44_encontros_ao_vivo.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ENGAJAMENTO</span>
          <h2>Encontros ao vivo</h2>
        </div>
      </div>

      <p className="adm-hint">
        Agende reuniões por produto. Os alunos com acesso veem o encontro dentro do curso e entram pela própria área de membros; a sala abre 30
        minutos antes. Você entra como dono da sala pelo botão <strong>Entrar</strong>. A gravação é feita por você (OBS). Se preferir usar o
        Google Meet, cole o link dele no campo abaixo: os alunos veem <strong>AO VIVO</strong> e entram pelo Meet, e o encontro encerra
        sozinho no fim da duração (ou quando você clicar em <strong>Encerrar agora</strong>).
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <style>{`
        .mt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .mt-grid label{min-width:0}
        .mt-grid select,.mt-grid input{width:100%;min-width:0;box-sizing:border-box}
        .mt-wide{grid-column:1/-1}
        .mt-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
        .mt-hint{margin:0;font-size:.78rem;color:#66798c}
        .mt-live{color:#a60d25}
        @media(max-width:700px){.mt-grid{grid-template-columns:minmax(0,1fr)}}
      `}</style>

      <form className="cp-form" onSubmit={submit}>
        <h3>{editingId ? "Editar encontro" : "Novo encontro"}</h3>
        <div className="cp-grid mt-grid">
          <label>Produto
            <select value={form.product_id} onChange={set("product_id")} required>
              <option value="">Escolha...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.title}</option>
              ))}
            </select>
          </label>
          <label>Título
            <input value={form.title} onChange={set("title")} placeholder="Ex.: Mentoria ao vivo — dúvidas da semana" maxLength={120} required />
          </label>
          <label>Data e hora
            <input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} required />
          </label>
          <label>Duração (minutos)
            <input type="number" min="15" max="480" value={form.duration_minutes} onChange={set("duration_minutes")} required />
          </label>
          <label className="mt-wide">Link do Google Meet (opcional)
            <input type="url" value={form.meet_url} onChange={set("meet_url")} placeholder="https://meet.google.com/abc-defg-hij" maxLength={300} />
          </label>
          <label className="mt-wide">Descrição (opcional)
            <input value={form.description} onChange={set("description")} placeholder="O que será visto neste encontro" maxLength={300} />
          </label>
        </div>
        <div className="mt-actions">
          <button className="admin-button primary" type="submit" disabled={saving || starting}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Agendar encontro"}</button>
          {!editingId && (
            <button className="admin-button" type="button" onClick={startNow} disabled={saving || starting}>
              {starting ? "Abrindo a sala..." : "Iniciar reunião agora"}
            </button>
          )}
          {editingId && <button className="admin-button adm-ghost" type="button" onClick={reset}>Cancelar edição</button>}
        </div>
        {!editingId && <p className="mt-hint">“Iniciar reunião agora” só precisa do produto: abre a sala na hora (ou, se você colou o link do Meet, já mostra AO VIVO para os alunos) e eles veem o botão de entrar no curso.</p>}
      </form>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : meetings.length === 0 ? (
        <div className="admin-empty">Nenhum encontro agendado ainda.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>QUANDO</th><th>ENCONTRO</th><th>PRODUTO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => {
                const state = meetingWindow({ ...meeting }, Date.now());
                const live = meetingLive(meeting);
                return (
                  <tr key={meeting.id}>
                    <td>{when(meeting.starts_at)}<br /><small>{meeting.duration_minutes} min</small></td>
                    <td>{meeting.title}</td>
                    <td>{titleOf(meeting.product_id)}</td>
                    <td>
                      {live ? <strong className="mt-live">AO VIVO</strong> : state === "ended" ? "Encerrado" : state === "open" ? "Sala aberta" : "Agendado"}
                      {meeting.meet_url && <small style={{ display: "block" }}>Google Meet</small>}
                      {meeting.ended_at && <small style={{ display: "block" }}>encerrado às {new Date(meeting.ended_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>}
                    </td>
                    <td>
                      {meeting.meet_url ? (
                        <a className="admin-button primary" href={meeting.meet_url} target="_blank" rel="noopener noreferrer">Abrir Meet</a>
                      ) : (
                        <Link className="admin-button primary" to={`/minha-area/encontro/${meeting.id}`}>Entrar</Link>
                      )}{" "}
                      {state === "open" && !meeting.ended_at && <><button type="button" className="admin-button" onClick={() => endNow(meeting)}>Encerrar agora</button>{" "}<button type="button" className="admin-button" onClick={() => extend(meeting)}>+30 min</button>{" "}</>}
                      {meeting.ended_at && <><button type="button" className="admin-button" onClick={() => reopen(meeting)}>Reabrir</button>{" "}</>}
                      <button type="button" className="admin-button" onClick={() => edit(meeting)}>Editar</button>{" "}
                      <button type="button" className="admin-button adm-ghost" onClick={() => remove(meeting)}>Excluir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
