import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

const EVENT_SLUG = "aulao-aph-barro-2026";

function toCsv(rows) {
  const headers = ["Nome", "WhatsApp", "E-mail", "Cidade", "Profissão", "Experiência APH", "Objetivo", "Origem", "Inscrito em"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = rows.map((row) => [
    row.full_name,
    row.whatsapp,
    row.email,
    row.city,
    row.occupation,
    row.aph_experience,
    row.main_goal,
    row.source,
    new Date(row.created_at).toLocaleString("pt-BR"),
  ].map(escape).join(","));
  return [headers.map(escape).join(","), ...lines].join("\n");
}

export default function EventRegistrationsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_slug", EVENT_SLUG)
        .order("created_at", { ascending: false });

      if (loadError) {
        console.error(loadError);
        setError("Não foi possível carregar as inscrições.");
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.full_name, row.whatsapp, row.email, row.city, row.occupation, row.main_goal]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [rows, query]);

  const exportCsv = () => {
    const blob = new Blob(["\ufeff", toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "inscricoes-aulao-barro.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const deleteLead = async (row) => {
    const confirmed = window.confirm(
      `Excluir definitivamente a inscrição de ${row.full_name}?\n\nEssa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    setError("");

    const { error: deleteError } = await supabase
      .from("event_registrations")
      .delete()
      .eq("id", row.id)
      .eq("event_slug", EVENT_SLUG);

    if (deleteError) {
      console.error(deleteError);
      setError("Não foi possível excluir este lead. Verifique as permissões do Supabase e tente novamente.");
    } else {
      setRows((current) => current.filter((item) => item.id !== row.id));
    }

    setDeletingId(null);
  };

  return (
    <section>
      <style>{`
        .event-admin-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:24px}.event-admin-head h2{margin:4px 0 0;font-size:2rem}.event-admin-head p{margin:0;color:#6f7f8e}.event-admin-actions{display:flex;gap:10px;flex-wrap:wrap}.event-admin-actions input{min-height:42px;border:1px solid #d5dde5;border-radius:9px;padding:0 12px;min-width:240px}.event-admin-actions button{border:0;border-radius:9px;padding:0 14px;min-height:42px;background:#d6152d;color:#fff;font-weight:850;cursor:pointer}.event-stat{display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border-radius:10px;background:#f3f6f8;border:1px solid #e2e7eb;font-weight:850;margin-bottom:18px}.event-table-wrap{overflow:auto;border:1px solid #e2e7eb;border-radius:14px;background:#fff}.event-table{width:100%;border-collapse:collapse;min-width:1080px}.event-table th,.event-table td{text-align:left;padding:13px 14px;border-bottom:1px solid #edf1f4;font-size:.85rem}.event-table th{background:#f7f9fb;color:#344d64;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}.event-table td strong{display:block;color:#0b2034}.event-table td small{color:#748594}.event-empty{padding:32px;text-align:center;color:#6f7f8e}.event-error-box{padding:14px;border-radius:10px;background:#fff1f2;color:#9f1023;font-weight:800;margin-bottom:14px}.event-delete-btn{min-height:36px;padding:0 12px;border-radius:8px;border:1px solid #f2b9c1;background:#fff1f2;color:#a20d22;font-weight:850;cursor:pointer}.event-delete-btn:hover{background:#ffe3e7}.event-delete-btn:disabled{opacity:.55;cursor:not-allowed}
        @media(max-width:760px){.event-admin-head{align-items:start;flex-direction:column}.event-admin-actions{width:100%}.event-admin-actions input{min-width:0;flex:1}}
      `}</style>

      <div className="event-admin-head">
        <div>
          <p>EVENTO • BARRO–CE</p>
          <h2>Inscrições do Aulão APH</h2>
        </div>
        <div className="event-admin-actions">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, cidade, objetivo..." />
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0}>Exportar CSV</button>
        </div>
      </div>

      <div className="event-stat">Total de inscritos: <strong>{rows.length}</strong></div>

      {error && <div className="event-error-box">{error}</div>}

      {loading ? (
        <div className="event-empty">Carregando inscrições...</div>
      ) : (
        <div className="event-table-wrap">
          <table className="event-table">
            <thead>
              <tr>
                <th>Inscrito</th>
                <th>WhatsApp</th>
                <th>Cidade</th>
                <th>Profissão</th>
                <th>Experiência</th>
                <th>Objetivo</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" className="event-empty">Nenhum inscrito encontrado.</td></tr>
              ) : filtered.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.full_name}</strong><small>{row.email}</small></td>
                  <td>{row.whatsapp}</td>
                  <td>{row.city || "—"}</td>
                  <td>{row.occupation || "—"}</td>
                  <td>{row.aph_experience || "—"}</td>
                  <td>{row.main_goal || "—"}</td>
                  <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                  <td>
                    <button
                      type="button"
                      className="event-delete-btn"
                      onClick={() => deleteLead(row)}
                      disabled={deletingId === row.id}
                    >
                      {deletingId === row.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
