import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import FormRunner from "../../components/forms/FormRunner";
import { formatScore, typeLabel } from "../../services/forms";
import { supabase } from "../../services/supabase";
import "../../styles/forms-public.css";

// Formulário aberto ao público (pesquisas, coleta de informações). Provas de alunos abrem dentro da área do aluno.
export default function PublicFormPage() {
  const { slug } = useParams();
  const [form, setForm] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [startedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    const load = async () => {
      const { data: row } = await supabase.from("forms").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
      if (!row) {
        setMessage("Este formulário não está disponível.");
        setLoading(false);
        return;
      }
      setForm(row);
      if (row.audience !== "students") {
        const { data: list, error } = await supabase.from("form_blocks").select("*").eq("form_id", row.id).order("position");
        if (error) setMessage(error.message);
        else setBlocks(list || []);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const send = async (answers, { identity }) => {
    setSending(true);
    setMessage("");
    const { data, error } = await supabase.rpc("submit_public_form", {
      p_form_id: form.id,
      p_respondent: { name: identity.name.trim(), email: identity.email.trim(), started_at: startedAt },
      p_answers: answers,
    });
    setSending(false);
    if (error) {
      setMessage(error.message || "Não foi possível enviar.");
      return false;
    }
    setResult(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  };

  if (loading) return <main className="pf-state">Carregando...</main>;
  if (!form) return <main className="pf-state"><h1>Indisponível</h1><p>{message}</p></main>;
  if (form.audience === "students") return <Navigate to={`/minha-area/atividades/${form.slug}`} replace />;

  if (result) {
    const showScore = Boolean(form.settings?.show_score) && !result.pending_manual && Number(result.max_score) > 0;
    return (
      <main className="pf-page">
        <div className="pf-shell">
          <div className="pf-success">
            <h1>Obrigado por participar</h1>
            <p>Suas respostas foram registradas.</p>
            {showScore && (
              <div className="pf-score">
                <strong>{formatScore(result.score)} / {formatScore(result.max_score)}</strong>
                <small>pontuação</small>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pf-page">
      <div className="pf-shell">
        <header className="pf-hero">
          <span>{typeLabel(form.type)}</span>
          <h1>{form.title}</h1>
          {form.description && <p>{form.description}</p>}
        </header>
        <FormRunner form={form} blocks={blocks} mode="public" onSubmit={send} sending={sending} error={message} />
      </div>
    </main>
  );
}
