import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";

const empty = { student_id:"", student_name:"", student_photo:"", profession:"", product_id:"", title:"", testimonial:"", rating:5, testimonial_date:new Date().toISOString().slice(0,10), institution:"", city:"", result_achieved:"", media_url:"", status:"draft", is_featured:false, is_verified:false, publication_authorized:false, display_order:0 };

export default function FeedbackEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [products, setProducts] = useState([]);
  const [students, setStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const [p, s] = await Promise.all([
        supabase.from("products").select("id,title").order("title"),
        supabase.from("profiles").select("id,full_name,email").eq("role","student").order("full_name"),
      ]);
      setProducts(p.data || []); setStudents(s.data || []);
      if (!isNew) {
        const { data, error } = await supabase.from("student_feedbacks").select("*").eq("id", id).single();
        if (error) setMessage(`Erro: ${error.message}`); else setForm({ ...empty, ...data, student_id:data.student_id||"", product_id:data.product_id||"" });
      }
    };
    load();
  }, [id, isNew]);

  const set = (key, value) => setForm((old)=>({ ...old, [key]: value }));
  const selectStudent = (studentId) => {
    const student = students.find((s)=>s.id===studentId);
    setForm((old)=>({ ...old, student_id:studentId, student_name: student?.full_name || old.student_name }));
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setMessage("");
    const payload = { ...form, student_id:form.student_id||null, product_id:form.product_id||null, rating:Number(form.rating), display_order:Number(form.display_order), created_by:user?.id };
    const result = isNew ? await supabase.from("student_feedbacks").insert(payload).select("id").single() : await supabase.from("student_feedbacks").update(payload).eq("id",id).select("id").single();
    setSaving(false);
    if (result.error) setMessage(`Erro ao salvar: ${result.error.message}`);
    else { setMessage("Feedback salvo com sucesso."); if (isNew) navigate(`/admin/feedbacks/${result.data.id}`, { replace:true }); }
  };

  return <section className="admin-section"><div className="admin-section-head"><div><span>FEEDBACK</span><h2>{isNew?"Novo feedback":"Editar feedback"}</h2></div><Link className="admin-button" to="/admin/feedbacks">Voltar</Link></div>
    <form className="admin-form" onSubmit={save}>
      <div className="form-grid two"><label>Aluno cadastrado<select value={form.student_id} onChange={(e)=>selectStudent(e.target.value)}><option value="">Não vincular</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</select></label><label>Nome do aluno *<input required value={form.student_name} onChange={(e)=>set("student_name",e.target.value)} /></label></div>
      <div className="form-grid two"><label>Profissão/formação<input value={form.profession} onChange={(e)=>set("profession",e.target.value)} /></label><label>Produto<select value={form.product_id} onChange={(e)=>set("product_id",e.target.value)}><option value="">Sem produto</option>{products.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div>
      <div className="form-grid two"><label>Título<input value={form.title} onChange={(e)=>set("title",e.target.value)} /></label><label>Data<input type="date" value={form.testimonial_date} onChange={(e)=>set("testimonial_date",e.target.value)} /></label></div>
      <label>Depoimento *<textarea required rows="7" value={form.testimonial} onChange={(e)=>set("testimonial",e.target.value)} /></label>
      <div className="form-grid three"><label>Nota<select value={form.rating} onChange={(e)=>set("rating",e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} estrelas</option>)}</select></label><label>Status<select value={form.status} onChange={(e)=>set("status",e.target.value)}><option value="draft">Rascunho</option><option value="review">Em análise</option><option value="published">Publicado</option><option value="hidden">Oculto</option><option value="archived">Arquivado</option></select></label><label>Ordem<input type="number" value={form.display_order} onChange={(e)=>set("display_order",e.target.value)} /></label></div>
      <div className="form-grid two"><label>Cidade<input value={form.city} onChange={(e)=>set("city",e.target.value)} /></label><label>Instituição<input value={form.institution} onChange={(e)=>set("institution",e.target.value)} /></label></div>
      <label>Resultado alcançado<textarea rows="3" value={form.result_achieved} onChange={(e)=>set("result_achieved",e.target.value)} /></label>
      <div className="form-grid two"><label>URL da foto<input type="url" value={form.student_photo} onChange={(e)=>set("student_photo",e.target.value)} placeholder="https://..." /></label><label>URL da mídia<input type="url" value={form.media_url} onChange={(e)=>set("media_url",e.target.value)} placeholder="https://..." /></label></div>
      <div className="check-grid"><label><input type="checkbox" checked={form.publication_authorized} onChange={(e)=>set("publication_authorized",e.target.checked)} /> Autorizado para publicação pública</label><label><input type="checkbox" checked={form.is_featured} onChange={(e)=>set("is_featured",e.target.checked)} /> Marcar como destaque</label><label><input type="checkbox" checked={form.is_verified} onChange={(e)=>set("is_verified",e.target.checked)} /> Aluno verificado</label></div>
      {message && <div className="admin-alert">{message}</div>}
      <div className="form-actions"><button className="admin-button primary" disabled={saving}>{saving?"Salvando...":"Salvar feedback"}</button><Link className="admin-button" to="/admin/feedbacks">Cancelar</Link></div>
    </form>
  </section>;
}
