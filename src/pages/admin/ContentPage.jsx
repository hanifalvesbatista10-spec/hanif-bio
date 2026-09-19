import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const statusLabels = { draft: "Rascunho", review: "Em análise", published: "Publicado", hidden: "Oculto", archived: "Arquivado" };
const typeLabels = { artigo: "Conteúdo gratuito", material: "Material para download" };

export default function ContentPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_content")
      .select("*")
      .order("content_type", { ascending: true })
      .order("display_order", { ascending: true });
    if (error) setMessage(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const removeRow = async (row) => {
    if (!window.confirm(`Excluir definitivamente "${row.title}"?`)) return;
    const { error } = await supabase.from("site_content").delete().eq("id", row.id);
    if (error) setMessage(`Não foi possível excluir: ${error.message}`);
    else {
      setMessage("Item excluído com sucesso.");
      load();
    }
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>CONTEÚDO</span>
          <h2>Conteúdos e materiais gratuitos</h2>
        </div>
        <button type="button" className="admin-button primary" onClick={() => navigate("/admin/conteudos/novo")}>
          + Novo item
        </button>
      </div>

      {message && <div className="admin-alert">{message}</div>}

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">Nenhum conteúdo cadastrado ainda.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ordem</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title}</strong>
                    <small>/{row.slug}</small>
                  </td>
                  <td>{typeLabels[row.content_type] || row.content_type}</td>
                  <td><span className={`status-badge ${row.status}`}>{statusLabels[row.status] || row.status}</span></td>
                  <td>{row.display_order}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => navigate(`/admin/conteudos/${row.id}`)}>Editar</button>
                      <button onClick={() => removeRow(row)}>Excluir</button>
                    </div>
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
