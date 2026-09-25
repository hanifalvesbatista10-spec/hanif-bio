import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RowActions from "../../components/admin/RowActions";
import { supabase } from "../../services/supabase";
import { friendlyFormError, typeLabel } from "../../services/forms";
import "../../styles/forms-admin.css";

const STATUS = {
  draft: { label: "Rascunho", tone: "is-draft" },
  published: { label: "Publicado", tone: "is-published" },
  closed: { label: "Encerrado", tone: "is-draft" },
  archived: { label: "Arquivado", tone: "is-draft" },
};

const FILTERS = [
  ["all", "Todos"],
  ["published", "Publicados"],
  ["draft", "Rascunhos"],
  ["closed", "Encerrados"],
];

export default function FormsPage() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: subs }] = await Promise.all([
      supabase.from("forms").select("id,title,slug,type,status,audience,created_at").order("created_at", { ascending: false }),
      supabase.from("form_submissions").select("form_id,pending_manual,status").neq("status", "in_progress"),
    ]);
    if (error) notify("error", friendlyFormError(error));
    else setRows(data || []);
    const map = {};
    (subs || []).forEach((sub) => {
      map[sub.form_id] ||= { total: 0, pending: 0 };
      map[sub.form_id].total += 1;
      if (sub.pending_manual) map[sub.form_id].pending += 1;
    });
    setCounts(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (row) => {
    if (!window.confirm(`Excluir "${row.title}" e todas as respostas? Não dá para desfazer.`)) return;
    const { error } = await supabase.from("forms").delete().eq("id", row.id);
    if (error) notify("error", error.message);
    else {
      notify("success", "Excluído.");
      load();
    }
  };

  const duplicate = async (row) => {
    const { data, error } = await supabase.rpc("form_duplicate", { p_form_id: row.id });
    if (error) return notify("error", friendlyFormError(error));
    notify("success", "Cópia criada como rascunho.");
    navigate(`/admin/formularios/${data}`);
  };

  const copyLink = async (row) => {
    const url = `${window.location.origin}/f/${row.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      notify("success", "Link copiado.");
    } catch {
      window.prompt("Copie o link:", url);
    }
  };

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => (filter === "all" || row.status === filter) && (!term || row.title.toLowerCase().includes(term)));
  }, [rows, filter, query]);

  const pendingTotal = Object.values(counts).reduce((sum, item) => sum + item.pending, 0);

  return (
    <section className="admin-section fa">
      <div className="fa-top">
        <div>
          <h2>Provas e atividades</h2>
          <p className="fa-sub">
            Provas, simulados, tarefas e pesquisas.
            {pendingTotal > 0 && ` Você tem ${pendingTotal} ${pendingTotal === 1 ? "resposta" : "respostas"} para corrigir.`}
          </p>
        </div>
        <div className="fa-top-actions">
          <button className="fa-btn" type="button" onClick={() => navigate("/admin/formularios/novo")}>+ Criar novo</button>
        </div>
      </div>

      {message && <div className={`fa-alert is-${messageType}`} role="status">{message}</div>}

      <div className="fa-toolbar">
        <div className="fa-seg" role="group" aria-label="Filtrar por situação">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <input className="fa-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo título…" aria-label="Buscar" />
      </div>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : shown.length === 0 ? (
        <div className="admin-empty">{rows.length === 0 ? "Nada criado ainda. Clique em “Criar novo” para montar sua primeira prova." : "Nada encontrado com esse filtro."}</div>
      ) : (
        <div className="fa-table-wrap">
          <table className="fa-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Tipo</th>
                <th>Quem responde</th>
                <th>Situação</th>
                <th>Respostas</th>
                <th className="is-end"><span className="ra-th">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const status = STATUS[row.status] || STATUS.draft;
                const count = counts[row.id] || { total: 0, pending: 0 };
                return (
                  <tr key={row.id}>
                    <td><strong>{row.title}</strong><small>/f/{row.slug}</small></td>
                    <td>{typeLabel(row.type)}</td>
                    <td>{row.audience === "students" ? "Só alunos logados" : "Link público"}</td>
                    <td><span className={`fa-pill ${status.tone}`}>{status.label}</span></td>
                    <td className="is-num">
                      {count.total}
                      {count.pending > 0 && <small><span className="fa-pill is-review">{count.pending} para corrigir</span></small>}
                    </td>
                    <td className="is-end">
                      <RowActions
                        label={`Ações de ${row.title}`}
                        primary={{ label: "Resultados", to: `/admin/formularios/${row.id}/resultados` }}
                        items={[
                          { label: "Editar", to: `/admin/formularios/${row.id}` },
                          { label: "Duplicar", onClick: () => duplicate(row) },
                          { label: "Copiar link", onClick: () => copyLink(row) },
                          { label: "Abrir como aluno", hidden: row.status !== "published", href: `/f/${row.slug}` },
                          { label: "Excluir", danger: true, onClick: () => remove(row) },
                        ]}
                      />
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
