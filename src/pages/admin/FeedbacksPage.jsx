import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";

const statusLabels = { draft: "Rascunho", review: "Em análise", published: "Publicado", hidden: "Oculto", archived: "Arquivado" };

export default function FeedbacksPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    let query = supabase.from("student_feedbacks").select("id,student_name,title,rating,status,publication_authorized,is_featured,testimonial_date,product:products(title)").order("created_at", { ascending: false });
    if (status !== "all") query = query.eq("status", status);
    if (search.trim()) query = query.or(`student_name.ilike.%${search.trim()}%,title.ilike.%${search.trim()}%,testimonial.ilike.%${search.trim()}%`);
    const { data, error } = await query;
    if (error) setMessage(`Erro: ${error.message}`);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const remove = async (id) => {
    if (!window.confirm("Excluir este feedback definitivamente?")) return;
    const { error } = await supabase.from("student_feedbacks").delete().eq("id", id);
    if (error) setMessage(`Erro ao excluir: ${error.message}`);
    else { setMessage("Feedback excluído."); load(); }
  };

  return <section className="admin-section">
    <div className="admin-section-head"><div><span>CONTEÚDO</span><h2>Feedbacks</h2></div><Link className="admin-button primary" to="/admin/feedbacks/novo">+ Novo feedback</Link></div>
    <div className="admin-toolbar">
      <input value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&load()} placeholder="Pesquisar por aluno, título ou depoimento" />
      <select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">Todos os status</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <button onClick={load}>Pesquisar</button>
    </div>
    {message && <div className="admin-alert">{message}</div>}
    {loading ? <div className="admin-empty">Carregando...</div> : rows.length === 0 ? <div className="admin-empty">Nenhum feedback encontrado.</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Aluno</th><th>Produto</th><th>Nota</th><th>Status</th><th>Público</th><th>Ações</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.student_name}</strong><small>{row.title || "Sem título"}</small></td><td>{row.product?.title || "—"}</td><td>{"★".repeat(row.rating || 0)}</td><td><span className={`status-badge ${row.status}`}>{statusLabels[row.status] || row.status}</span></td><td>{row.publication_authorized ? "Sim" : "Não"}{row.is_featured ? " • Destaque" : ""}</td><td><div className="table-actions"><Link to={`/admin/feedbacks/${row.id}`}>Editar</Link><button onClick={()=>remove(row.id)}>Excluir</button></div></td></tr>)}</tbody></table></div>}
  </section>;
}
