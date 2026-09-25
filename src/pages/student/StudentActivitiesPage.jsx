import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import { formatDateTime, formatScore, friendlyFormError, typeLabel } from "../../services/forms";
import { supabase } from "../../services/supabase";
import { ActivityTabs } from "./StudentMyPerformancePage";

export function activityStatus(item) {
  const last = item.last;
  if (item.in_progress) return { tone: "is-wait", text: "Em andamento" };
  if (last?.released) {
    const score = Number(last.max_score) > 0 ? `Nota ${formatScore(last.score)} de ${formatScore(last.max_score)}` : "Resultado liberado";
    if (last.passed === true) return { tone: "is-ok", text: `${score} · Aprovado` };
    if (last.passed === false) return { tone: "is-bad", text: `${score} · Abaixo da nota mínima` };
    return { tone: "is-ok", text: score };
  }
  if (last?.pending_manual) return { tone: "is-wait", text: "Enviada, aguardando correção" };
  if (last) {
    return item.release_mode === "date" && item.release_at
      ? { tone: "is-wait", text: `Enviada, resultado em ${formatDateTime(item.release_at)}` }
      : { tone: "is-wait", text: "Enviada, aguardando a liberação do resultado" };
  }
  return null;
}

function meta(item) {
  return [
    item.question_count ? `${item.question_count} ${item.question_count === 1 ? "questão" : "questões"}` : null,
    item.time_limit_minutes ? `${item.time_limit_minutes} min` : null,
    item.max_attempts ? `${item.max_attempts} ${item.max_attempts === 1 ? "tentativa" : "tentativas"}` : null,
    item.pass_score !== null && item.pass_score !== undefined ? `nota mínima ${formatScore(item.pass_score)}%` : null,
    item.ends_at ? `até ${formatDateTime(item.ends_at)}` : null,
  ].filter(Boolean);
}

export default function StudentActivitiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("form_list_for_student").then(({ data, error: rpcError }) => {
      if (rpcError) setError(friendlyFormError(rpcError));
      else setItems(data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="mb-page is-narrow">
      <div className="mb-page-head">
        <h1>Atividades</h1>
        <p>Provas, simulados e tarefas dos seus cursos. A nota e os comentários aparecem quando o instrutor liberar.</p>
      </div>

      <ActivityTabs current="activities" />

      {error && <div className="mb-alert is-error" role="alert">{error}</div>}

      {loading ? (
        <div className="mb-list" aria-hidden="true">
          <div className="mb-row is-skeleton"><i /></div>
          <div className="mb-row is-skeleton"><i /></div>
        </div>
      ) : items.length === 0 && !error ? (
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.activities}</span>
          <h2>Nenhuma atividade por aqui ainda</h2>
          <p>Quando o instrutor publicar uma prova, um simulado ou uma tarefa para você, ela aparece nesta página.</p>
        </div>
      ) : (
        <ul className="mb-list">
          {items.map((item) => {
            const status = activityStatus(item);
            const info = meta(item);
            const path = `/minha-area/atividades/${item.slug}`;
            return (
              <li className="mb-row mb-act" key={item.id}>
                <div className="mb-row-text">
                  <span className="mb-act-type">{typeLabel(item.type)}</span>
                  <strong>{item.title}</strong>
                  {info.length > 0 && <span>{info.join(" · ")}</span>}
                  {status && <span className={`fx-chip ${status.tone}`}>{status.text}</span>}
                  {!item.can_start && !item.in_progress && item.attempts_used > 0 && item.max_attempts && item.attempts_used >= item.max_attempts && (
                    <span>Você já usou todas as tentativas.</span>
                  )}
                </div>
                <div className="mb-row-actions">
                  {item.last?.released && (
                    <Link className="mb-btn is-ghost is-small" to={`${path}/resultado/${item.last.submission_id}`}>Ver resultado</Link>
                  )}
                  {(item.in_progress || item.can_start) && (
                    <Link className="mb-btn is-small" to={path}>
                      {item.in_progress ? "Continuar" : item.attempts_used > 0 ? "Refazer" : "Começar"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
