import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

const types = [
  ["survey","Pesquisa"],
  ["exam","Prova"],
  ["activity","Atividade"],
  ["task","Tarefa"],
  ["information","Coleta de informações"],
];

const blockTypes = [
  ["heading","Título/seção"],
  ["text","Texto explicativo"],
  ["image","Imagem"],
  ["short_text","Resposta curta"],
  ["long_text","Resposta longa"],
  ["choice","Múltipla escolha"],
  ["multi_choice","Caixas de seleção"],
  ["true_false","Verdadeiro ou falso"],
  ["yes_no","Sim ou não"],
  ["scale","Escala 0 a 10"],
];

const slugify = (value="") => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

const emptyBlock = () => ({
  id: crypto.randomUUID(),
  type: "short_text",
  title: "",
  description: "",
  image_url: "",
  options_text: "",
  required: false,
  correct_answer: "",
  points: 0,
});

export default function FormBuilderPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title:"", slug:"", description:"", type:"survey", status:"draft",
    require_name:true, require_email:false, show_score:false,
    starts_at:"", ends_at:""
  });
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!editing) return;
    const load = async () => {
      const [{ data:f, error:fe }, { data:b, error:be }] = await Promise.all([
        supabase.from("forms").select("*").eq("id", id).single(),
        supabase.from("form_blocks").select("*").eq("form_id", id).order("position")
      ]);
      if (fe || be) setMessage(fe?.message || be?.message);
      else {
        setForm({
          title:f.title || "", slug:f.slug || "", description:f.description || "",
          type:f.type || "survey", status:f.status || "draft",
          require_name:f.settings?.require_name !== false,
          require_email:Boolean(f.settings?.require_email),
          show_score:Boolean(f.settings?.show_score),
          starts_at:f.starts_at ? f.starts_at.slice(0,16) : "",
          ends_at:f.ends_at ? f.ends_at.slice(0,16) : "",
        });
        setBlocks((b || []).map(x => ({
          ...x,
          options_text:Array.isArray(x.options) ? x.options.join("\n") : "",
          correct_answer:x.correct_answer || "",
          image_url:x.image_url || "",
          description:x.description || "",
          title:x.title || ""
        })));
      }
      setLoading(false);
    };
    load();
  }, [editing,id]);

  const updateForm = (key,value) => setForm(current => {
    const next = {...current,[key]:value};
    if (key === "title" && !editing) next.slug = slugify(value);
    return next;
  });

  const updateBlock = (index,key,value) => setBlocks(current => current.map((b,i)=>i===index?{...b,[key]:value}:b));
  const addBlock = () => setBlocks(current => [...current, emptyBlock()]);
  const removeBlock = (index) => setBlocks(current => current.filter((_,i)=>i!==index));
  const move = (index,dir) => setBlocks(current => {
    const target = index + dir;
    if (target < 0 || target >= current.length) return current;
    const copy = [...current];
    [copy[index],copy[target]] = [copy[target],copy[index]];
    return copy;
  });

  const uploadImage = async (file) => {
    if (!file) return "";
    if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
    if (file.size > 5*1024*1024) throw new Error("Imagem deve ter no máximo 5 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `forms/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("forms-media").upload(path,file,{contentType:file.type,upsert:false});
    if (error) throw error;
    return supabase.storage.from("forms-media").getPublicUrl(path).data.publicUrl;
  };

  const save = async (publish=false) => {
    setSaving(true);
    setMessage("");
    try {
      if (!form.title.trim()) throw new Error("Informe o título.");
      const slug = slugify(form.slug || form.title);
      if (!slug) throw new Error("Informe um endereço válido.");

      const payload = {
        title:form.title.trim(),
        slug,
        description:form.description.trim() || null,
        type:form.type,
        status:publish ? "published" : form.status,
        settings:{
          require_name:Boolean(form.require_name),
          require_email:Boolean(form.require_email),
          show_score:Boolean(form.show_score),
        },
        starts_at:form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at:form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };

      let formId = id;
      if (editing) {
        const { error } = await supabase.from("forms").update(payload).eq("id",id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("forms").insert(payload).select("id").single();
        if (error) throw error;
        formId = data.id;
      }

      await supabase.from("form_blocks").delete().eq("form_id",formId);

      const rows = blocks.map((b,index)=>({
        form_id:formId,
        type:b.type,
        title:(b.title || "").trim() || null,
        description:(b.description || "").trim() || null,
        image_url:b.image_url || null,
        options:["choice","multi_choice"].includes(b.type)
          ? (b.options_text || "").split("\n").map(v=>v.trim()).filter(Boolean)
          : b.type==="true_false" ? ["Verdadeiro","Falso"]
          : b.type==="yes_no" ? ["Sim","Não"]
          : [],
        required:Boolean(b.required),
        correct_answer:(b.correct_answer || "").trim() || null,
        points:Number(b.points) || 0,
        position:index,
      }));

      if (rows.length) {
        const { error } = await supabase.from("form_blocks").insert(rows);
        if (error) throw error;
      }

      setMessage(publish ? "Publicado com sucesso. O link já pode ser enviado." : "Salvo com sucesso.");
      if (!editing) navigate(`/admin/formularios/${formId}`, { replace:true });
      if (publish) setForm(current=>({...current,status:"published"}));
    } catch (e) {
      setMessage(e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const publicLink = `${window.location.origin}/f/${form.slug || slugify(form.title)}`;

  if (loading) return <section className="admin-section">Carregando...</section>;

  return (
    <section className="admin-section">
      <style>{`
        .fb-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:18px}.fb-head h2{margin:3px 0;color:#071426}.fb-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.1em}
        .fb-actions-top{display:flex;gap:8px;flex-wrap:wrap}.fb-btn{min-height:42px;padding:0 14px;border-radius:10px;font-weight:900;cursor:pointer}.fb-btn.dark{border:0;background:#071426;color:#fff}.fb-btn.red{border:0;background:#d6152d;color:#fff}.fb-btn.light{border:1px solid #d9e2ea;background:#fff;color:#24394e}
        .fb-card{background:#fff;border:1px solid #e0e7ee;border-radius:18px;padding:20px;margin-bottom:16px}.fb-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fb-field{display:grid;gap:6px}.fb-field.full{grid-column:1/-1}.fb-field label{font-size:.78rem;font-weight:900;color:#2d4256}.fb-field input,.fb-field textarea,.fb-field select{width:100%;padding:11px 12px;border:1px solid #d7e0e8;border-radius:10px;font:inherit}.fb-field textarea{min-height:90px;resize:vertical}.fb-check{display:flex;gap:8px;align-items:center;font-weight:800;color:#30465a}.fb-check input{width:18px;height:18px}
        .fb-block{border:1px solid #dfe6ed;border-radius:16px;padding:17px;background:#fbfcfd;margin-top:12px}.fb-block-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.fb-block-head strong{color:#071426}.fb-mini{display:flex;gap:6px}.fb-mini button{border:1px solid #d8e1e8;background:#fff;border-radius:8px;min-width:34px;height:34px;cursor:pointer;font-weight:900}.fb-mini .del{color:#b11830}
        .fb-link{padding:12px;border-radius:10px;background:#f3f6f9;color:#52677b;word-break:break-all;font-size:.82rem}.fb-add{width:100%;min-height:48px;border:1px dashed #bac7d2;border-radius:12px;background:#fff;color:#21384e;font-weight:900;cursor:pointer}
        @media(max-width:760px){.fb-head{align-items:stretch;flex-direction:column}.fb-grid{grid-template-columns:1fr}.fb-field.full{grid-column:auto}}
      `}</style>

      <div className="fb-head">
        <div><span>FORMULÁRIOS E ATIVIDADES</span><h2>{editing ? "Editar" : "Criar novo"}</h2></div>
        <div className="fb-actions-top">
          <button className="fb-btn light" type="button" onClick={()=>navigate("/admin/formularios")}>Voltar</button>
          <button className="fb-btn dark" type="button" disabled={saving} onClick={()=>save(false)}>Salvar rascunho</button>
          <button className="fb-btn red" type="button" disabled={saving} onClick={()=>save(true)}>Publicar</button>
        </div>
      </div>

      {message && <div className="admin-alert">{message}</div>}

      <div className="fb-card">
        <div className="fb-grid">
          <div className="fb-field full"><label>Título *</label><input value={form.title} onChange={e=>updateForm("title",e.target.value)} /></div>
          <div className="fb-field full"><label>Descrição / instruções</label><textarea value={form.description} onChange={e=>updateForm("description",e.target.value)} /></div>
          <div className="fb-field"><label>Tipo</label><select value={form.type} onChange={e=>updateForm("type",e.target.value)}>{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          <div className="fb-field"><label>Status</label><select value={form.status} onChange={e=>updateForm("status",e.target.value)}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="closed">Fechado</option><option value="archived">Arquivado</option></select></div>
          <div className="fb-field"><label>Endereço do link</label><input value={form.slug} onChange={e=>updateForm("slug",e.target.value)} /></div>
          <div className="fb-field"><label>Abertura (opcional)</label><input type="datetime-local" value={form.starts_at} onChange={e=>updateForm("starts_at",e.target.value)} /></div>
          <div className="fb-field"><label>Encerramento (opcional)</label><input type="datetime-local" value={form.ends_at} onChange={e=>updateForm("ends_at",e.target.value)} /></div>
          <div className="fb-field"><label className="fb-check"><input type="checkbox" checked={form.require_name} onChange={e=>updateForm("require_name",e.target.checked)} /> Exigir nome</label></div>
          <div className="fb-field"><label className="fb-check"><input type="checkbox" checked={form.require_email} onChange={e=>updateForm("require_email",e.target.checked)} /> Exigir e-mail</label></div>
          <div className="fb-field"><label className="fb-check"><input type="checkbox" checked={form.show_score} onChange={e=>updateForm("show_score",e.target.checked)} /> Mostrar nota ao final</label></div>
          <div className="fb-field full"><label>Link público</label><div className="fb-link">{publicLink}</div></div>
        </div>
      </div>

      <div className="fb-card">
        <h3 style={{marginTop:0}}>Conteúdo</h3>
        {blocks.map((b,index)=>(
          <div className="fb-block" key={b.id || index}>
            <div className="fb-block-head">
              <strong>Bloco {index+1}</strong>
              <div className="fb-mini">
                <button type="button" onClick={()=>move(index,-1)}>↑</button>
                <button type="button" onClick={()=>move(index,1)}>↓</button>
                <button className="del" type="button" onClick={()=>removeBlock(index)}>×</button>
              </div>
            </div>
            <div className="fb-grid">
              <div className="fb-field"><label>Tipo do bloco</label><select value={b.type} onChange={e=>updateBlock(index,"type",e.target.value)}>{blockTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
              <div className="fb-field"><label>Pontos</label><input type="number" min="0" step="0.5" value={b.points ?? 0} onChange={e=>updateBlock(index,"points",e.target.value)} /></div>
              <div className="fb-field full"><label>Título / pergunta</label><input value={b.title || ""} onChange={e=>updateBlock(index,"title",e.target.value)} /></div>
              <div className="fb-field full"><label>Descrição / orientação</label><textarea value={b.description || ""} onChange={e=>updateBlock(index,"description",e.target.value)} /></div>
              {["choice","multi_choice"].includes(b.type) && <div className="fb-field full"><label>Alternativas (uma por linha)</label><textarea value={b.options_text || ""} onChange={e=>updateBlock(index,"options_text",e.target.value)} /></div>}
              {["choice","true_false","yes_no","short_text"].includes(b.type) && <div className="fb-field"><label>Resposta correta (opcional)</label><input value={b.correct_answer || ""} onChange={e=>updateBlock(index,"correct_answer",e.target.value)} /></div>}
              <div className="fb-field"><label>Imagem no bloco (opcional)</label><input type="file" accept="image/*" onChange={async e=>{try{const url=await uploadImage(e.target.files?.[0]); if(url) updateBlock(index,"image_url",url)}catch(err){setMessage(err.message)}}} /></div>
              {b.image_url && <div className="fb-field full"><img src={b.image_url} alt="" style={{maxWidth:320,borderRadius:12}} /></div>}
              {!["heading","text","image"].includes(b.type) && <div className="fb-field"><label className="fb-check"><input type="checkbox" checked={Boolean(b.required)} onChange={e=>updateBlock(index,"required",e.target.checked)} /> Resposta obrigatória</label></div>}
            </div>
          </div>
        ))}
        <button className="fb-add" type="button" onClick={addBlock}>+ Adicionar bloco / pergunta</button>
      </div>
    </section>
  );
}
