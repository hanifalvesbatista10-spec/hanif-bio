import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

export default function FormResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{data:f,error:fe},{data:b,error:be},{data:s,error:se}] = await Promise.all([
        supabase.from("forms").select("*").eq("id",id).single(),
        supabase.from("form_blocks").select("*").eq("form_id",id).order("position"),
        supabase.from("form_submissions").select("*").eq("form_id",id).order("submitted_at",{ascending:false})
      ]);
      if (fe || be || se) {
        setMessage(fe?.message || be?.message || se?.message);
        setLoading(false);
        return;
      }
      setForm(f);
      setBlocks(b || []);
      setSubmissions(s || []);

      const ids = (s || []).map(x=>x.id);
      if (ids.length) {
        const { data:a, error:ae } = await supabase.from("form_answers").select("*").in("submission_id", ids);
        if (ae) setMessage(ae.message);
        else setAnswers(a || []);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const scored = submissions.filter(x => x.max_score && Number(x.max_score) > 0);
    const avg = scored.length ? scored.reduce((sum,x)=>sum + Number(x.score || 0),0) / scored.length : 0;
    const avgPercent = scored.length ? scored.reduce((sum,x)=>sum + (Number(x.score || 0)/Number(x.max_score))*100,0) / scored.length : 0;
    return { total, avg, avgPercent, scored:scored.length };
  }, [submissions]);

  const answersFor = (submissionId) => answers.filter(a=>a.submission_id===submissionId);

  const exportCsv = () => {
    const header = ["nome","email","data","nota","nota_maxima",...blocks.filter(b=>!["heading","text","image"].includes(b.type)).map(b=>b.title || b.id)];
    const rows = submissions.map(s => {
      const map = Object.fromEntries(answersFor(s.id).map(a=>[a.block_id,Array.isArray(a.answer) ? a.answer.join(" | ") : (a.answer ?? "")]));
      return [s.respondent_name || "",s.respondent_email || "",s.submitted_at || "",s.score ?? "",s.max_score ?? "",...blocks.filter(b=>!["heading","text","image"].includes(b.type)).map(b=>map[b.id] ?? "")];
    });
    const esc = v => `"${String(v).replaceAll('"','""')}"`;
    const csv = [header,...rows].map(r=>r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=`${form?.slug || "resultados"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <section className="admin-section">Carregando resultados...</section>;

  return (
    <section className="admin-section">
      <style>{`
        .fr-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:20px}.fr-head h2{margin:4px 0;color:#071426}.fr-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.1em}.fr-actions{display:flex;gap:8px;flex-wrap:wrap}.fr-actions button{min-height:42px;padding:0 13px;border-radius:10px;font-weight:900;cursor:pointer}.fr-dark{border:0;background:#071426;color:#fff}.fr-light{border:1px solid #d9e1e8;background:#fff;color:#263c50}
        .fr-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.fr-stat{background:#fff;border:1px solid #e1e7ed;border-radius:16px;padding:18px}.fr-stat span{display:block;color:#6a7d8f;font-size:.75rem;font-weight:800}.fr-stat strong{display:block;margin-top:5px;color:#071426;font-size:1.7rem}
        .fr-layout{display:grid;grid-template-columns:.8fr 1.2fr;gap:16px}.fr-list,.fr-detail{background:#fff;border:1px solid #e1e7ed;border-radius:18px;padding:18px}.fr-row{width:100%;text-align:left;border:1px solid #e1e7ed;background:#fff;border-radius:12px;padding:12px;margin:6px 0;cursor:pointer}.fr-row.active{border-color:#071426;background:#f3f6f9}.fr-row strong{display:block;color:#071426}.fr-row small{color:#738596}.fr-detail h3{margin-top:0}.fr-answer{padding:13px 0;border-bottom:1px solid #edf1f4}.fr-answer:last-child{border-bottom:0}.fr-answer b{display:block;color:#2a4055;margin-bottom:5px}.fr-answer p{margin:0;color:#617487;white-space:pre-wrap}.fr-empty{color:#748698;text-align:center;padding:26px}
        @media(max-width:850px){.fr-head{align-items:stretch;flex-direction:column}.fr-stats{grid-template-columns:1fr}.fr-layout{grid-template-columns:1fr}}
      `}</style>

      <div className="fr-head">
        <div><span>RESULTADOS</span><h2>{form?.title || "Formulário"}</h2></div>
        <div className="fr-actions">
          <button className="fr-light" type="button" onClick={()=>navigate("/admin/formularios")}>Voltar</button>
          <button className="fr-light" type="button" onClick={()=>navigate(`/admin/formularios/${id}`)}>Editar</button>
          <button className="fr-dark" type="button" onClick={exportCsv} disabled={!submissions.length}>Exportar CSV</button>
        </div>
      </div>

      {message && <div className="admin-alert">{message}</div>}

      <div className="fr-stats">
        <div className="fr-stat"><span>Respostas</span><strong>{stats.total}</strong></div>
        <div className="fr-stat"><span>Média de pontos</span><strong>{stats.scored ? stats.avg.toFixed(1) : "—"}</strong></div>
        <div className="fr-stat"><span>Média percentual</span><strong>{stats.scored ? `${stats.avgPercent.toFixed(0)}%` : "—"}</strong></div>
      </div>

      <div className="fr-layout">
        <div className="fr-list">
          <h3>Participantes</h3>
          {!submissions.length ? <div className="fr-empty">Ainda não há respostas.</div> : submissions.map(s=>(
            <button className={`fr-row ${selected?.id===s.id?"active":""}`} type="button" key={s.id} onClick={()=>setSelected(s)}>
              <strong>{s.respondent_name || "Resposta anônima"}</strong>
              <small>{s.respondent_email || new Date(s.submitted_at).toLocaleString("pt-BR")}</small>
            </button>
          ))}
        </div>

        <div className="fr-detail">
          {!selected ? <div className="fr-empty">Selecione uma resposta para ver os detalhes.</div> : (
            <>
              <h3>{selected.respondent_name || "Resposta anônima"}</h3>
              <p style={{color:"#66798c"}}>{selected.respondent_email || "Sem e-mail"} • {new Date(selected.submitted_at).toLocaleString("pt-BR")}</p>
              {Number(selected.max_score)>0 && <p><strong>Nota:</strong> {selected.score} / {selected.max_score}</p>}
              {blocks.filter(b=>!["heading","text","image"].includes(b.type)).map(block=>{
                const a = answersFor(selected.id).find(x=>x.block_id===block.id);
                let display = a?.answer;
                if (Array.isArray(display)) display = display.join(", ");
                if (display === null || display === undefined || display === "") display = "—";
                return <div className="fr-answer" key={block.id}><b>{block.title || "Pergunta"}</b><p>{String(display)}</p>{a?.is_correct !== null && a?.is_correct !== undefined && <small>{a.is_correct ? "Correta" : "Incorreta"}{a.points_awarded !== null ? ` • ${a.points_awarded} ponto(s)` : ""}</small>}</div>;
              })}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
