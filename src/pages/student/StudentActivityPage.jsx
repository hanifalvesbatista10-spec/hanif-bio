import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FormRunner from "../../components/forms/FormRunner";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import { useAuth } from "../../contexts/AuthContext";
import { formatDateTime, formatScore, friendlyFormError, typeLabel } from "../../services/forms";
import { supabase } from "../../services/supabase";

// Responder uma prova, simulado ou tarefa dentro da área do aluno: apresentação, tentativa e envio.
export default function StudentActivityPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [info, setInfo] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [stage, setStage] = useState("loading"); // loading | intro | run | done | unavailable
  const [outcome, setOutcome] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [{ data: formRow }, { data: list, error: listError }] = await Promise.all([
      supabase.from("forms").select("*").eq("slug", slug).eq("status", "published").maybeSingle(),
      supabase.rpc("form_list_for_student"),
    ]);
    if (listError) {
      setError(friendlyFormError(listError));
      setStage("unavailable");
      return;
    }
    const item = (list || []).find((entry) => entry.slug === slug);
    if (!formRow || !item) {
      setStage("unavailable");
      return;
    }
    setForm(formRow);
    setInfo(item);
    setStage("intro");
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setError("");
    const { data, error: startError } = await supabase.rpc("form_start_attempt", { p_form_id: form.id });
    if (startError) {
      setError(friendlyFormError(startError));
      setBusy(false);
      return;
    }
    const { data: rows, error: blocksError } = await supabase.from("form_blocks").select("*").eq("form_id", form.id).order("position");
    if (blocksError || !rows?.length) {
      setError(blocksError ? friendlyFormError(blocksError) : "Esta atividade ainda não tem perguntas.");
      setBusy(false);
      return;
    }
    setBlocks(rows);
    setSubmission({ id: data.submission_id, deadline_at: data.deadline_at, attempt_number: data.attempt_number });
    setStage("run");
    setBusy(false);
    window.scrollTo({ top: 0 });
  };

  const send = async (answers) => {
    setBusy(true);
    setError("");
    const { data, error: sendError } = await supabase.rpc("form_submit", {
      p_form_id: form.id,
      p_submission_id: submission.id,
      p_answers: answers,
    });
    setBusy(false);
    if (sendError) {
      setError(friendlyFormError(sendError));
      return false;
    }
    setOutcome(data);
    setStage("done");
    window.scrollTo({ top: 0 });
    return true;
  };

  if (stage === "loading") {
    return <div className="mb-page is-narrow"><div className="mb-card" aria-busy="true"><i className="mb-skel-line" /></div></div>;
  }

  if (stage === "unavailable") {
    return (
      <div className="mb-page is-narrow">
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.activities}</span>
          <h2>Esta atividade não está disponível</h2>
          <p>{error || "Ela pode ter sido encerrada ou não estar liberada para a sua conta."}</p>
          <Link className="mb-btn" to="/minha-area/atividades">Ver minhas atividades</Link>
        </div>
      </div>
    );
  }

  if (stage === "run") {
    return (
      <div className="mb-page is-narrow">
        <div className="mb-crumb"><span className="mb-crumb-static">{typeLabel(form.type)} · Tentativa {submission.attempt_number}</span></div>
        <div className="mb-page-head is-tight"><h1>{form.title}</h1></div>
        <FormRunner form={form} blocks={blocks} mode="student" userId={user?.id} submission={submission} onSubmit={send} sending={busy} error={error} />
      </div>
    );
  }

  if (stage === "done") {
    const expired = outcome?.expired;
    return (
      <div className="mb-page is-narrow">
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.check}</span>
          <h2>{expired ? "O tempo terminou" : "Respostas enviadas"}</h2>
          <p>
            {expired
              ? "A tentativa foi encerrada porque o tempo acabou antes do envio."
              : outcome?.released
                ? "Sua correção já está pronta."
                : outcome?.pending_manual
                  ? "Algumas questões precisam da correção do instrutor. Você vê a nota e os comentários quando ele liberar."
                  : form.release_mode === "date" && form.release_at
                    ? `A nota e os comentários ficam disponíveis em ${formatDateTime(form.release_at)}.`
                    : "O instrutor libera a nota e os comentários em breve. Você encontra tudo na aba Atividades."}
          </p>
          <div className="mb-actions" style={{ justifyContent: "center" }}>
            {outcome?.released && <Link className="mb-btn" to={`/minha-area/atividades/${slug}/resultado/${outcome.submission_id}`}>Ver resultado</Link>}
            <Link className="mb-btn is-ghost" to="/minha-area/atividades">Voltar às atividades</Link>
          </div>
        </div>
      </div>
    );
  }

  // apresentação
  const rules = [
    info.question_count ? `${info.question_count} ${info.question_count === 1 ? "questão" : "questões"}${Number(info.total_points) > 0 ? `, valendo ${formatScore(info.total_points)} pontos` : ""}` : null,
    info.time_limit_minutes ? `Você tem ${info.time_limit_minutes} minutos depois de começar. Ao acabar o tempo, o envio é automático.` : null,
    info.max_attempts ? `${info.max_attempts === 1 ? "Uma tentativa" : `${info.max_attempts} tentativas`} (você já usou ${info.attempts_used}).` : null,
    info.pass_score !== null && info.pass_score !== undefined ? `Nota mínima para aprovação: ${formatScore(info.pass_score)}%.` : null,
    info.release_mode === "manual" ? "A nota e os comentários aparecem quando o instrutor liberar." : null,
    info.release_mode === "date" && info.release_at ? `A nota e os comentários aparecem em ${formatDateTime(info.release_at)}.` : null,
    info.ends_at ? `Disponível até ${formatDateTime(info.ends_at)}.` : null,
  ].filter(Boolean);

  const canGo = info.in_progress || info.can_start;
  return (
    <div className="mb-page is-narrow">
      <div className="mb-crumb"><Link to="/minha-area/atividades">{icons.arrowLeft} Atividades</Link></div>
      <div className="mb-card">
        <div className="mb-card-head">
          <span className="mb-act-type">{typeLabel(form.type)}</span>
          <h2>{form.title}</h2>
          {form.description && <p style={{ whiteSpace: "pre-line" }}>{form.description}</p>}
        </div>
        {rules.length > 0 && (
          <ul className="mb-rules">
            {rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        )}
        {error && <div className="mb-alert is-error" role="alert">{error}</div>}
        <div className="mb-actions">
          {canGo ? (
            <button type="button" className="mb-btn" onClick={start} disabled={busy}>
              {busy ? "Abrindo..." : info.in_progress ? "Continuar tentativa" : info.attempts_used > 0 ? "Começar nova tentativa" : "Começar"}
            </button>
          ) : (
            <p className="mb-note">{info.attempts_used > 0 ? "Você já usou todas as tentativas." : "Esta atividade não está aberta agora."}</p>
          )}
          {info.last?.released && (
            <Link className="mb-btn is-ghost" to={`/minha-area/atividades/${slug}/resultado/${info.last.submission_id}`}>Ver último resultado</Link>
          )}
        </div>
      </div>
    </div>
  );
}
