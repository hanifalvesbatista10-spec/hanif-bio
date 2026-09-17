import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const labels = {
  survey: "Pesquisa",
  exam: "Prova",
  activity: "Atividade",
  task: "Tarefa",
  information: "Coleta de informações",
};

export default function FormsPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("forms")
      .select("id,title,slug,type,status,created_at")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (row) => {
    if (!window.confirm(`Excluir definitivamente "${row.title}" e todas as respostas?`)) return;
    const { error } = await supabase.from("forms").delete().eq("id", row.id);
    if (error) setMessage(error.message);
    else {
      setMessage("Item excluído com sucesso.");
      load();
    }
  };

  const copyLink = async (row) => {
    const url = `${window.location.origin}/f/${row.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copiado.");
    } catch {
      window.prompt("Copie o link:", url);
    }
  };

  return (
    <section className="admin-section">
      <style>{`
        .forms-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:22px}
        .forms-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.12em}.forms-head h2{margin:4px 0 0;color:#071426;font-size:2rem}
        .forms-new{border:0;border-radius:12px;background:#d6152d;color:#fff;padding:13px 18px;font-weight:900;cursor:pointer}
        .forms-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.form-card{background:#fff;border:1px solid #e0e7ee;border-radius:18px;padding:20px;box-shadow:0 12px 34px rgba(7,20,38,.06)}
        .form-card-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.form-type{font-size:.7rem;font-weight:900;color:#d6152d;letter-spacing:.08em;text-transform:uppercase}.form-status{font-size:.68rem;font-weight:900;padding:5px 8px;border-radius:999px;background:#eef3f7;color:#30475d}
        .form-card h3{margin:12px 0 7px;color:#071426}.form-url{font-size:.78rem;color:#6b7f91;word-break:break-all}.form-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.form-actions button{min-height:40px;border-radius:10px;font-weight:900;cursor:pointer;padding:0 12px}.primary{background:#071426;color:#fff;border:0}.secondary{background:#fff;border:1px solid #d7e0e8;color:#263b50}.danger{background:#fff4f5;border:1px solid #f0c2c9;color:#b21d34}.forms-empty{padding:40px;border:1px dashed #cbd5df;border-radius:18px;text-align:center;color:#65788a;background:#fff}
        @media(max-width:760px){.forms-head{align-items:stretch;flex-direction:column}.forms-grid{grid-template-columns:1fr}.forms-new{width:100%}}
      `}</style>

      <div className="forms-head">
        <div><span>CONSTRUTOR</span><h2>Formulários e atividades</h2></div>
        <button className="forms-new" type="button" onClick={() => navigate("/admin/formularios/novo")}>+ Criar novo</button>
      </div>

      {message && <div className="admin-alert">{message}</div>}

      {loading ? <div className="forms-empty">Carregando...</div> : rows.length === 0 ? (
        <div className="forms-empty">Nenhuma pesquisa, prova ou atividade criada ainda.</div>
      ) : (
        <div className="forms-grid">
          {rows.map((row) => (
            <article className="form-card" key={row.id}>
              <div className="form-card-top">
                <span className="form-type">{labels[row.type] || row.type}</span>
                <span className="form-status">{row.status}</span>
              </div>
              <h3>{row.title}</h3>
              <div className="form-url">/f/{row.slug}</div>
              <div className="form-actions">
                <button className="primary" type="button" onClick={() => navigate(`/admin/formularios/${row.id}`)}>Editar</button>
                <button className="secondary" type="button" onClick={() => navigate(`/admin/formularios/${row.id}/resultados`)}>Resultados</button>
                <button className="secondary" type="button" onClick={() => copyLink(row)}>Copiar link</button>
                <button className="secondary" type="button" onClick={() => window.open(`/f/${row.slug}`, "_blank")}>Abrir</button>
                <button className="danger" type="button" onClick={() => remove(row)}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
