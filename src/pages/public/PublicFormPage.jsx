import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

export default function PublicFormPage() {
  const { slug } = useParams();
  const [form, setForm] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [answers, setAnswers] = useState({});
  const [identity, setIdentity] = useState({ name:"", email:"" });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const startedAt = useMemo(() => new Date().toISOString(), []);

  useEffect(() => {
    const load = async () => {
      const { data:f, error:fe } = await supabase
        .from("forms")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (fe || !f) {
        setMessage("Este formulário não está disponível.");
        setLoading(false);
        return;
      }

      const { data:b, error:be } = await supabase
        .from("form_blocks")
        .select("*")
        .eq("form_id", f.id)
        .order("position");

      if (be) setMessage(be.message);
      else {
        setForm(f);
        setBlocks(b || []);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const setAnswer = (id, value) => setAnswers(current => ({ ...current, [id]:value }));

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    const settings = form?.settings || {};
    if (settings.require_name && !identity.name.trim()) return setMessage("Informe seu nome.");
    if (settings.require_email && !identity.email.trim()) return setMessage("Informe seu e-mail.");

    for (const block of blocks) {
      if (!block.required) continue;
      const value = answers[block.id];
      const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      if (empty) return setMessage(`Responda: ${block.title || "campo obrigatório"}`);
    }

    setSending(true);
    try {
      const payloadAnswers = blocks
        .filter(b => !["heading","text","image"].includes(b.type))
        .map(b => ({ block_id:b.id, value:answers[b.id] ?? null }));

      const { data, error } = await supabase.rpc("submit_public_form", {
        p_form_id: form.id,
        p_respondent: {
          name:identity.name.trim(),
          email:identity.email.trim(),
          started_at:startedAt
        },
        p_answers:payloadAnswers
      });

      if (error) throw error;
      setResult(data);
      window.scrollTo({ top:0, behavior:"smooth" });
    } catch (e) {
      setMessage(e.message || "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  };

  const renderField = (block) => {
    const value = answers[block.id] ?? "";
    if (block.type === "short_text") return <input value={value} onChange={e=>setAnswer(block.id,e.target.value)} />;
    if (block.type === "long_text") return <textarea value={value} onChange={e=>setAnswer(block.id,e.target.value)} />;
    if (block.type === "choice" || block.type === "true_false" || block.type === "yes_no") {
      const options = block.options || [];
      return <div className="pf-options">{options.map(opt => <label key={opt}><input type="radio" name={block.id} checked={value===opt} onChange={()=>setAnswer(block.id,opt)} /> <span>{opt}</span></label>)}</div>;
    }
    if (block.type === "multi_choice") {
      const selected = Array.isArray(value) ? value : [];
      return <div className="pf-options">{(block.options || []).map(opt => <label key={opt}><input type="checkbox" checked={selected.includes(opt)} onChange={e=>setAnswer(block.id,e.target.checked ? [...selected,opt] : selected.filter(x=>x!==opt))} /> <span>{opt}</span></label>)}</div>;
    }
    if (block.type === "scale") {
      return <div className="pf-scale">{Array.from({length:11},(_,i)=>i).map(n=><button type="button" className={value===n ? "active":""} key={n} onClick={()=>setAnswer(block.id,n)}>{n}</button>)}</div>;
    }
    return null;
  };

  if (loading) return <main className="pf-state">Carregando...</main>;
  if (!form) return <main className="pf-state"><h1>Indisponível</h1><p>{message}</p></main>;

  if (result) {
    const showScore = Boolean(form.settings?.show_score);
    return <main className="pf-page"><style>{styles}</style><div className="pf-shell"><div className="pf-success"><span>RESPOSTA ENVIADA</span><h1>Obrigado por participar.</h1><p>Suas respostas foram registradas com sucesso.</p>{showScore && Number(result.max_score)>0 && <div className="pf-score"><strong>{result.score} / {result.max_score}</strong><small>pontuação</small></div>}</div></div></main>;
  }

  return (
    <main className="pf-page">
      <style>{styles}</style>
      <div className="pf-shell">
        <header className="pf-hero">
          <span>{form.type === "exam" ? "AVALIAÇÃO" : form.type === "survey" ? "PESQUISA" : "ATIVIDADE"}</span>
          <h1>{form.title}</h1>
          {form.description && <p>{form.description}</p>}
        </header>

        <form onSubmit={submit}>
          {(form.settings?.require_name || form.settings?.require_email) && (
            <section className="pf-card">
              <h2>Identificação</h2>
              <div className="pf-id-grid">
                {form.settings?.require_name && <label><span>Nome *</span><input value={identity.name} onChange={e=>setIdentity(v=>({...v,name:e.target.value}))} /></label>}
                {form.settings?.require_email && <label><span>E-mail *</span><input type="email" value={identity.email} onChange={e=>setIdentity(v=>({...v,email:e.target.value}))} /></label>}
              </div>
            </section>
          )}

          {blocks.map((block,index) => {
            if (block.type === "heading") return <section className="pf-heading" key={block.id}><span>SEÇÃO {index+1}</span><h2>{block.title}</h2>{block.description && <p>{block.description}</p>}{block.image_url && <img src={block.image_url} alt="" />}</section>;
            if (block.type === "text") return <section className="pf-text" key={block.id}>{block.title && <h3>{block.title}</h3>}<p>{block.description}</p>{block.image_url && <img src={block.image_url} alt="" />}</section>;
            if (block.type === "image") return <section className="pf-image" key={block.id}>{block.title && <h3>{block.title}</h3>}{block.image_url && <img src={block.image_url} alt={block.title || "Imagem da atividade"} />}{block.description && <p>{block.description}</p>}</section>;

            return <section className="pf-card" key={block.id}>
              <div className="pf-qhead"><span>QUESTÃO {index+1}</span>{block.required && <b>Obrigatória</b>}</div>
              <h2>{block.title}</h2>
              {block.description && <p className="pf-desc">{block.description}</p>}
              {block.image_url && <img className="pf-question-image" src={block.image_url} alt="" />}
              <div className="pf-field">{renderField(block)}</div>
            </section>;
          })}

          {message && <div className="pf-error">{message}</div>}
          <button className="pf-submit" disabled={sending}>{sending ? "Enviando..." : "Enviar respostas"}</button>
        </form>
      </div>
    </main>
  );
}

const styles = `
  .pf-page{min-height:100vh;background:#f3f6f9;color:#071426;padding:42px 0 80px;font-family:Inter,system-ui,sans-serif}.pf-shell{width:min(820px,calc(100% - 28px));margin:0 auto}.pf-hero{padding:34px;border-radius:24px;background:linear-gradient(135deg,#071426,#16334f);color:#fff;margin-bottom:18px}.pf-hero span,.pf-heading span,.pf-qhead span{font-size:.68rem;font-weight:950;letter-spacing:.13em;color:#ff8ea0}.pf-hero h1{font-size:clamp(2.2rem,7vw,4.5rem);line-height:.98;letter-spacing:-.045em;margin:10px 0 14px}.pf-hero p{margin:0;color:#c5d1dc;line-height:1.7}.pf-card,.pf-text,.pf-image,.pf-heading{background:#fff;border:1px solid #e0e7ee;border-radius:18px;padding:24px;margin:14px 0}.pf-card h2,.pf-heading h2{margin:8px 0 10px}.pf-text p,.pf-image p,.pf-heading p,.pf-desc{color:#5d7184;line-height:1.7}.pf-id-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pf-id-grid label{display:grid;gap:6px}.pf-id-grid span{font-size:.8rem;font-weight:900}.pf-field input[type=text],.pf-field input:not([type]),.pf-field textarea,.pf-id-grid input{width:100%;border:1px solid #d5dfe7;border-radius:11px;padding:13px;font:inherit}.pf-field textarea{min-height:120px;resize:vertical}.pf-options{display:grid;gap:9px}.pf-options label{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #dfe6ed;border-radius:11px;cursor:pointer}.pf-options input{width:18px;height:18px}.pf-scale{display:grid;grid-template-columns:repeat(11,1fr);gap:5px}.pf-scale button{min-height:40px;border:1px solid #d9e2e9;background:#fff;border-radius:9px;font-weight:900;cursor:pointer}.pf-scale button.active{background:#071426;color:#fff}.pf-qhead{display:flex;justify-content:space-between;align-items:center}.pf-qhead b{font-size:.67rem;color:#d6152d}.pf-question-image,.pf-image img,.pf-heading img,.pf-text img{width:100%;max-height:520px;object-fit:contain;border-radius:14px;margin:12px 0;background:#eef2f5}.pf-submit{width:100%;min-height:58px;border:0;border-radius:14px;background:#d6152d;color:#fff;font-weight:950;font-size:1rem;cursor:pointer;margin-top:16px}.pf-submit:disabled{opacity:.6}.pf-error{margin:14px 0;padding:13px 15px;background:#fff0f2;border:1px solid #efc3ca;color:#a40f26;border-radius:11px;font-weight:800}.pf-state{min-height:100vh;display:grid;place-content:center;text-align:center;background:#f3f6f9;padding:24px}.pf-success{background:#fff;border:1px solid #e0e7ee;border-radius:24px;padding:44px;text-align:center}.pf-success span{color:#d6152d;font-size:.72rem;font-weight:950;letter-spacing:.13em}.pf-success h1{font-size:clamp(2.2rem,6vw,4rem);margin:10px 0}.pf-score{display:grid;gap:3px;margin:24px auto 0;padding:18px;max-width:220px;border-radius:16px;background:#071426;color:#fff}.pf-score strong{font-size:2rem}.pf-score small{color:#aebdca}
  @media(max-width:650px){.pf-page{padding-top:18px}.pf-hero{padding:24px 20px}.pf-card,.pf-text,.pf-image,.pf-heading{padding:20px}.pf-id-grid{grid-template-columns:1fr}.pf-scale{grid-template-columns:repeat(6,1fr)}}
`;
