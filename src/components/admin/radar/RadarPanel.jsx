import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabase";
import { ACTION_LABELS, BASIS_LABELS, POPULATION_LABELS, STATUS_LABELS, TOPIC_LABELS, TYPE_LABELS, formatDate, radarAction, safeUrl } from "../../../services/radar";

const STATUS_FILTERS = {
  review: { label: "A revisar (rascunhos)", statuses: ["draft"] },
  approved: { label: "Aprovados (não publicados)", statuses: ["approved"] },
  published: { label: "Publicados", statuses: ["published"] },
  queue: { label: "Na fila de análise", statuses: ["pending_analysis", "analyzing", "candidate"] },
  closed: { label: "Rejeitados e arquivados", statuses: ["rejected", "archived"] },
  discarded: { label: "Descartados na triagem", statuses: ["discarded"] },
  all: { label: "Todos", statuses: null },
};

const RUN_STATUS = { running: "Em andamento", ok: "Concluída", no_news: "Sem novidades", partial: "Parcial (fila de análise)", error: "Erro" };
const EDITABLE = ["title_pt", "summary_pt", "main_finding", "what_changed", "evidence_strength", "limitations", "applicability_br", "official_grade", "topic", "population", "publication_type"];

const Field = ({ label, children, wide }) => (
  <label className={wide ? "rd-wide" : ""}>
    {label}
    {children}
  </label>
);

export default function RadarPanel() {
  const [settings, setSettings] = useState(null);
  const [missing, setMissing] = useState(false);
  const [runs, setRuns] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ status: "review", topic: "", from: "", to: "", text: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [item, setItem] = useState(null);
  const [priv, setPriv] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState({ type: "", text: "" });
  const autoStarted = useRef(false);

  const say = (type, text) => setNote({ type, text });

  const loadAll = useCallback(async () => {
    const [settingsResult, runsResult, itemsResult] = await Promise.all([
      supabase.from("radar_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("radar_runs").select("*").order("started_at", { ascending: false }).limit(8),
      supabase
        .from("radar_items")
        .select("id,title_pt,title_original,topic,population,status,source_name,published_date,discovered_at,publication_type,reviewer_name,approved_at,error_count")
        .order("discovered_at", { ascending: false })
        .limit(400),
    ]);
    if (settingsResult.error || !settingsResult.data) {
      setMissing(true);
      return [];
    }
    setSettings(settingsResult.data);
    setRuns(runsResult.data || []);
    setItems(itemsResult.data || []);
    return itemsResult.data || [];
  }, []);

  const loadItem = useCallback(async (id) => {
    const [itemResult, privResult] = await Promise.all([
      supabase.from("radar_items").select("*").eq("id", id).maybeSingle(),
      supabase.from("radar_item_private").select("*").eq("item_id", id).maybeSingle(),
    ]);
    setItem(itemResult.data);
    setPriv(privResult.data || {});
    setForm({
      ...Object.fromEntries(EDITABLE.map((key) => [key, itemResult.data?.[key] ?? ""])),
      course_updates: privResult.data?.course_updates ?? "",
      editorial_action: privResult.data?.editorial_action ?? "",
      featured: Boolean(itemResult.data?.featured),
    });
  }, []);

  const continueQueue = useCallback(async () => {
    setBusy("queue");
    let last = null;
    for (let i = 0; i < 8; i += 1) {
      const result = await radarAction("step");
      if (result.error) {
        say("error", result.error);
        last = null;
        break;
      }
      last = result;
      if (result.error === null && result.processed === 0) break;
      if (result.remaining === 0) break;
    }
    setBusy("");
    if (last) say(last.remaining > 0 ? "ok" : "ok", last.remaining > 0 ? `${last.remaining} item(ns) ainda aguardando análise.` : "Análise concluída: os rascunhos estão na lista para revisão.");
    await loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadAll().then((rows) => {
      // abriu o painel com itens na fila: continua a análise sozinho (uma vez)
      if (!autoStarted.current && rows.some((row) => ["pending_analysis", "candidate"].includes(row.status))) {
        autoStarted.current = true;
        continueQueue();
      }
    });
  }, [loadAll, continueQueue]);

  useEffect(() => {
    if (selectedId) loadItem(selectedId);
  }, [selectedId, loadItem]);

  const runNow = async () => {
    setBusy("run");
    say("", "");
    const result = await radarAction("run");
    if (result.error) say("error", result.error);
    else if (result.skipped) say("error", `Não executou: ${result.reason}`);
    else if (result.ok === false) say("error", `A coleta falhou: ${result.error}`);
    else say("ok", result.status === "no_news" ? "Coleta concluída: nenhuma novidade relevante desta vez." : `Coleta concluída: ${result.selected} item(ns) selecionado(s).`);
    setBusy("");
    const rows = await loadAll();
    if (rows.some((row) => ["pending_analysis", "candidate"].includes(row.status))) continueQueue();
  };

  const toggleSchedule = async (enabled) => {
    const { error } = await supabase.from("radar_settings").update({ enabled, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return say("error", `Não foi possível salvar: ${error.message}`);
    setSettings((current) => ({ ...current, enabled }));
    say("ok", enabled ? "Coleta automática ligada: toda sexta-feira, 8h (horário de Brasília)." : "Coleta automática desligada.");
  };

  const saveEdits = async () => {
    setBusy("save");
    const content = Object.fromEntries(EDITABLE.map((key) => [key, String(form[key] ?? "").trim() || null]));
    const [a, b] = await Promise.all([
      supabase.from("radar_items").update({ ...content, featured: Boolean(form.featured) }).eq("id", item.id),
      supabase.from("radar_item_private").upsert({ item_id: item.id, course_updates: String(form.course_updates || "").trim() || null, editorial_action: form.editorial_action || null }, { onConflict: "item_id" }),
    ]);
    setBusy("");
    if (a.error || b.error) return say("error", `Não foi possível salvar: ${(a.error || b.error).message}`);
    say("ok", item.status === "published" ? "Edição salva (já vale na página pública)." : "Edição salva.");
    await Promise.all([loadItem(item.id), loadAll()]);
  };

  const changeStatus = async (next, okText) => {
    setBusy("status");
    // publicar passa por "aprovado": o banco exige a aprovação e grava quem revisou e quando
    if (next === "published" && item.status !== "approved" && item.status !== "published") {
      const first = await supabase.from("radar_items").update({ status: "approved" }).eq("id", item.id);
      if (first.error) {
        setBusy("");
        return say("error", first.error.message);
      }
    }
    const { error } = await supabase.from("radar_items").update({ status: next }).eq("id", item.id);
    setBusy("");
    if (error) return say("error", error.message);
    say("ok", okText);
    await Promise.all([loadItem(item.id), loadAll()]);
  };

  const dismissPending = async () => {
    await supabase.from("radar_item_private").update({ pending_version: null }).eq("item_id", item.id);
    await loadItem(item.id);
  };

  const applyReanalysis = async () => {
    const a = priv?.pending_version?.analysis;
    if (!a) return;
    setForm((current) => ({ ...current, ...Object.fromEntries(Object.entries(a).filter(([key]) => EDITABLE.includes(key) || key === "course_updates" || key === "editorial_action")) }));
    say("ok", "Nova análise carregada nos campos abaixo. Revise e clique em “Salvar edições” para aplicar; depois descarte o aviso.");
  };

  const reanalyze = async () => {
    setBusy("reanalyze");
    const result = await radarAction("reanalyze", { id: item.id });
    setBusy("");
    if (result.error) return say("error", result.error);
    say("ok", "Nova análise gerada como versão pendente (o conteúdo atual não foi alterado).");
    await loadItem(item.id);
  };

  const visible = items.filter((row) => {
    const allowed = STATUS_FILTERS[filters.status].statuses;
    if (allowed && !allowed.includes(row.status)) return false;
    if (filters.topic && row.topic !== filters.topic) return false;
    if (filters.from && row.discovered_at.slice(0, 10) < filters.from) return false;
    if (filters.to && row.discovered_at.slice(0, 10) > filters.to) return false;
    if (filters.text && !`${row.title_pt || ""} ${row.title_original}`.toLowerCase().includes(filters.text.toLowerCase())) return false;
    return true;
  });
  const queued = items.filter((row) => ["pending_analysis", "analyzing", "candidate"].includes(row.status)).length;
  const lastOk = settings?.last_success_at;
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const pending = priv?.pending_version;

  if (missing) {
    return (
      <div className="admin-alert error">
        O banco ainda não tem o Radar de Evidências. Execute <strong>supabase/46_radar_evidencias.sql</strong> no SQL Editor do Supabase e recarregue.
      </div>
    );
  }
  if (!settings) return <div className="admin-empty">Carregando...</div>;

  return (
    <div className="rd">
      <style>{`
        .rd{display:grid;gap:18px}
        .rd-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
        .rd-card{background:#fff;border:1px solid var(--adm-border,#e3e9f0);border-radius:16px;padding:18px 20px;display:grid;gap:12px}
        .rd-card h3{margin:0}
        .rd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px}
        .rd-grid label,.rd-filters label{display:grid;gap:6px;font-weight:700;font-size:.82rem;min-width:0}
        .rd-grid input,.rd-grid select,.rd-grid textarea,.rd-filters input,.rd-filters select{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #d3dce6;border-radius:10px;font:inherit;font-weight:400}
        .rd-grid textarea{min-height:92px;resize:vertical}
        .rd-wide{grid-column:1/-1}
        .rd-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
        .rd-chip{display:inline-block;padding:3px 9px;border-radius:999px;background:#eef3f7;font-size:.72rem;font-weight:800}
        .rd-chip.is-published{background:#e3f6ea;color:#17683a}.rd-chip.is-draft{background:#fff3d6;color:#7a5200}.rd-chip.is-approved{background:#e0ecff;color:#1c4a9a}
        .rd-row{cursor:pointer}.rd-row:hover{background:#f6f9fc}.rd-row.is-open{background:#eef4fb}
        .rd-warn{padding:12px 14px;border-radius:12px;background:#fff3d6;color:#7a5200;font-size:.88rem;display:grid;gap:8px}
        .rd-refs a{word-break:break-all}
        .rd-raw{white-space:pre-wrap;font-size:.82rem;background:#f6f9fc;border-radius:10px;padding:10px 12px;max-height:220px;overflow:auto}
        @media(max-width:760px){.rd-grid{grid-template-columns:minmax(0,1fr)}}
      `}</style>

      <div className="rd-card">
        <h3>Radar Semanal de Evidências</h3>
        <p className="adm-hint" style={{ margin: 0 }}>
          Toda sexta-feira, às 8h, o sistema busca novas publicações sobre RCP/DEA, trauma e hemorragia, pediatria e neonatal e restrição de movimento da coluna (PubMed, ILCOR e NAEMSP),
          resume com IA e salva como <strong>rascunho</strong>. Nada aparece no site sem você aprovar e publicar.
        </p>
        <div className="rd-bar">
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
            <input type="checkbox" checked={settings.enabled} onChange={(e) => toggleSchedule(e.target.checked)} style={{ width: "auto" }} />
            Coleta automática toda sexta, 8h
          </label>
          <button type="button" className="admin-button primary" onClick={runNow} disabled={Boolean(busy)}>
            {busy === "run" ? "Buscando (até 1 minuto)..." : "Buscar atualizações agora"}
          </button>
          {queued > 0 && (
            <button type="button" className="admin-button" onClick={continueQueue} disabled={Boolean(busy)}>
              {busy === "queue" ? "Analisando..." : `Continuar análise (${queued} na fila)`}
            </button>
          )}
          <small style={{ color: "#66798c" }}>Última coleta bem-sucedida: {lastOk ? new Date(lastOk).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nenhuma ainda"}</small>
        </div>
        {note.text && <div className={`admin-alert ${note.type === "error" ? "error" : ""}`} role="status">{note.text}</div>}
      </div>

      <div className="rd-card">
        <h3>Publicações coletadas</h3>
        <div className="rd-filters">
          <label>Situação
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              {Object.entries(STATUS_FILTERS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <label>Tema
            <select value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}>
              <option value="">Todos</option>
              {Object.entries(TOPIC_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Coletado de<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
          <label>até<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
          <label>Buscar no título<input value={filters.text} onChange={(e) => setFilters({ ...filters, text: e.target.value })} placeholder="ex.: RCP" /></label>
        </div>
        {visible.length === 0 ? (
          <div className="admin-empty">Nada nesta situação. Use “Buscar atualizações agora” ou mude o filtro.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>TÍTULO</th><th>TEMA</th><th>SITUAÇÃO</th><th>FONTE</th><th>COLETADO</th></tr></thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className={`rd-row ${row.id === selectedId ? "is-open" : ""}`} onClick={() => setSelectedId(row.id)}>
                    <td>{row.title_pt || row.title_original}</td>
                    <td>{TOPIC_LABELS[row.topic] || "—"}</td>
                    <td><span className={`rd-chip is-${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span></td>
                    <td>{row.source_name}</td>
                    <td>{formatDate(row.discovered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {item && (
        <div className="rd-card">
          <h3>{item.title_pt || item.title_original}</h3>
          <div className="rd-bar">
            <span className={`rd-chip is-${item.status}`}>{STATUS_LABELS[item.status]}</span>
            <span className="rd-chip">{TYPE_LABELS[item.publication_type] || "Tipo não definido"}</span>
            <span className="rd-chip">{BASIS_LABELS[item.analysis_basis] || "Sem análise ainda"}</span>
            <span className="rd-chip">Versão {item.version}</span>
          </div>
          <p className="adm-hint" style={{ margin: 0 }}>
            <strong>Original:</strong> {item.title_original}{item.authors ? ` — ${item.authors}` : ""} ({item.source_name}). Publicado na fonte: {formatDate(item.published_date)} · Atualizado: {formatDate(item.updated_date)} · Entrou na base: {formatDate(item.discovered_at)}
            {item.source_status ? ` · Situação na fonte: ${item.source_status}` : ""}
            {item.reviewer_name ? ` · Aprovado por ${item.reviewer_name} em ${formatDate(item.approved_at)}` : ""}
            {item.published_at ? ` · Publicado em ${formatDate(item.published_at)}` : ""}
          </p>

          {pending && (
            <div className="rd-warn">
              <strong>Versão pendente de revisão (gerada pela automação)</strong>
              {pending.kind === "source_update" ? (
                <span>A situação do documento na fonte mudou de “{pending.from}” para “{pending.to}” ({formatDate(pending.detected_at)}). O conteúdo atual não foi alterado: reanalise e revise.</span>
              ) : (
                <span>Há uma nova análise gerada em {formatDate(pending.created_at)}. O conteúdo atual não foi alterado.</span>
              )}
              <div className="rd-bar">
                {pending.analysis && <button type="button" className="admin-button" onClick={applyReanalysis}>Carregar nova análise para revisão</button>}
                <button type="button" className="admin-button adm-ghost" onClick={dismissPending}>Descartar aviso</button>
              </div>
            </div>
          )}

          <div className="rd-bar">
            {safeUrl(item.source_url) && <a className="admin-button" href={safeUrl(item.source_url)} target="_blank" rel="noopener noreferrer">Abrir fonte original</a>}
            {item.status === "published" && <a className="admin-button" href={`/radar/${item.id}`} target="_blank" rel="noopener noreferrer">Ver na página pública</a>}
          </div>

          <div className="rd-grid">
            <Field label="Título em português" wide><input value={form.title_pt} onChange={set("title_pt")} /></Field>
            <Field label="Tema"><select value={form.topic} onChange={set("topic")}><option value="">—</option>{Object.entries(TOPIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="População"><select value={form.population} onChange={set("population")}><option value="">—</option>{Object.entries(POPULATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Tipo de publicação" wide><select value={form.publication_type} onChange={set("publication_type")}><option value="">—</option>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Resumo para o público" wide><textarea value={form.summary_pt} onChange={set("summary_pt")} /></Field>
            <Field label="Achado principal" wide><textarea value={form.main_finding} onChange={set("main_finding")} /></Field>
            <Field label="O que mudou em relação ao conhecimento anterior" wide><textarea value={form.what_changed} onChange={set("what_changed")} /></Field>
            <Field label="Força da evidência (análise crítica)"><textarea value={form.evidence_strength} onChange={set("evidence_strength")} /></Field>
            <Field label="Limitações"><textarea value={form.limitations} onChange={set("limitations")} /></Field>
            <Field label="Aplicabilidade ao APH brasileiro" wide><textarea value={form.applicability_br} onChange={set("applicability_br")} /></Field>
            <Field label="Classificação formal da fonte (GRADE, classe de recomendação — só se existir)" wide><input value={form.official_grade} onChange={set("official_grade")} placeholder="vazio = sem classificação oficial citada" /></Field>
            <label className="rd-wide" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={Boolean(form.featured)} onChange={(e) => setForm((current) => ({ ...current, featured: e.target.checked }))} style={{ width: "auto" }} />
              Destacar na página inicial e no topo do Radar (vale para itens publicados; clique em “Salvar edições”)
            </label>
            <Field label="Conduta editorial (interno, não aparece no site)"><select value={form.editorial_action} onChange={set("editorial_action")}><option value="">—</option>{Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="O que vale atualizar nos cursos e na Mentoria APH (interno)" wide><textarea value={form.course_updates} onChange={set("course_updates")} /></Field>
          </div>

          <div>
            <strong style={{ fontSize: ".85rem" }}>Referências</strong>
            <ul className="rd-refs" style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {(Array.isArray(item.references) ? item.references : []).map((ref) => (
                <li key={ref.url}>{safeUrl(ref.url) ? <a href={safeUrl(ref.url)} target="_blank" rel="noopener noreferrer">{ref.label} — {ref.url}</a> : ref.label}</li>
              ))}
            </ul>
          </div>

          <details>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Texto coletado da fonte (dado bruto, não confiável)</summary>
            <div className="rd-raw">{priv?.raw_text || "—"}</div>
          </details>
          {priv?.relevance_note && <p className="adm-hint" style={{ margin: 0 }}>Motivo da seleção: {priv.relevance_note}</p>}
          {priv?.discard_reason && <p className="adm-hint" style={{ margin: 0 }}>Motivo do descarte: {priv.discard_reason}</p>}
          {priv?.last_error && <p className="adm-hint" style={{ margin: 0, color: "#a60d25" }}>Último erro: {priv.last_error}</p>}

          <div className="rd-bar">
            <button type="button" className="admin-button" onClick={saveEdits} disabled={Boolean(busy)}>{busy === "save" ? "Salvando..." : "Salvar edições"}</button>
            {["draft", "approved"].includes(item.status) && (
              <button type="button" className="admin-button" onClick={() => changeStatus("approved", "Item aprovado (você consta como revisor). Ainda não está no site.")} disabled={Boolean(busy) || item.status === "approved"}>Aprovar</button>
            )}
            {["draft", "approved"].includes(item.status) && (
              <button type="button" className="admin-button primary" onClick={() => changeStatus("published", "Publicado no site.")} disabled={Boolean(busy)}>Aprovar e publicar</button>
            )}
            {item.status === "published" && <button type="button" className="admin-button" onClick={() => changeStatus("approved", "Despublicado: saiu do site, segue aprovado.")} disabled={Boolean(busy)}>Despublicar</button>}
            {["draft", "approved", "published"].includes(item.status) && <button type="button" className="admin-button" onClick={reanalyze} disabled={Boolean(busy)}>{busy === "reanalyze" ? "Reanalisando..." : "Reanalisar (versão pendente)"}</button>}
            {["approved", "published", "rejected", "archived"].includes(item.status) && <button type="button" className="admin-button adm-ghost" onClick={() => changeStatus("draft", "Voltou para rascunho (aprovação removida).")} disabled={Boolean(busy)}>Voltar a rascunho</button>}
            {["draft", "approved"].includes(item.status) && <button type="button" className="admin-button adm-ghost" onClick={() => changeStatus("rejected", "Item rejeitado.")} disabled={Boolean(busy)}>Rejeitar</button>}
            {item.status !== "archived" && <button type="button" className="admin-button adm-ghost" onClick={() => changeStatus("archived", "Item arquivado.")} disabled={Boolean(busy)}>Arquivar</button>}
          </div>
        </div>
      )}

      <div className="rd-card">
        <h3>Histórico das coletas</h3>
        {runs.length === 0 ? (
          <div className="admin-empty">Nenhuma coleta ainda.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>QUANDO</th><th>ORIGEM</th><th>SITUAÇÃO</th><th>ACHADOS</th><th>NOVOS</th><th>SELECIONADOS</th><th>ANALISADOS</th><th>DETALHE</th></tr></thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.started_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td>{run.trigger === "cron" ? "Agendada" : "Manual"}</td>
                    <td>{RUN_STATUS[run.status] || run.status}</td>
                    <td>{run.found}</td><td>{run.new_items}</td><td>{run.selected}</td><td>{run.analyzed}</td>
                    <td style={{ color: run.error ? "#a60d25" : undefined }}>{run.error || run.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
