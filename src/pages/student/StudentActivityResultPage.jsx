import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ResultReview from "../../components/forms/ResultReview";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import { formatDateTime, friendlyFormError, typeLabel } from "../../services/forms";
import { supabase } from "../../services/supabase";

// Resultado de uma tentativa: nota, gabarito e comentários (só depois da liberação).
export default function StudentActivityResultPage() {
  const { slug, submissionId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("form_get_my_result", { p_submission_id: submissionId }).then(({ data, error: rpcError }) => {
      if (rpcError) setError(friendlyFormError(rpcError));
      else setResult(data);
      setLoading(false);
    });
  }, [submissionId]);

  return (
    <div className="mb-page is-narrow">
      <div className="mb-crumb"><Link to="/minha-area/atividades">{icons.arrowLeft} Atividades</Link></div>

      {loading ? (
        <div className="mb-card" aria-busy="true"><i className="mb-skel-line" /></div>
      ) : error ? (
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.activities}</span>
          <h2>Não encontramos este resultado</h2>
          <p>{error}</p>
          <Link className="mb-btn" to="/minha-area/atividades">Ver minhas atividades</Link>
        </div>
      ) : (
        <>
          <div className="mb-page-head is-tight">
            <h1>{result.form.title}</h1>
            <p>{typeLabel(result.form.type)} · Tentativa {result.attempt_number} · enviada em {formatDateTime(result.submitted_at)}</p>
          </div>
          {result.released ? (
            <>
              <ResultReview result={result} />
              <div className="mb-actions">
                <Link className="mb-btn is-ghost" to="/minha-area/atividades">Voltar às atividades</Link>
                <Link className="mb-btn is-ghost" to={`/minha-area/atividades/${slug}`}>Ver detalhes da atividade</Link>
              </div>
            </>
          ) : (
            <div className="mb-empty">
              <span className="mb-empty-icon">{icons.check}</span>
              <h2>{result.pending_manual ? "Aguardando a correção do instrutor" : "Aguardando a liberação do resultado"}</h2>
              <p>
                {result.release_mode === "date" && result.release_at
                  ? `Sua nota e os comentários ficam disponíveis em ${formatDateTime(result.release_at)}.`
                  : "Suas respostas foram recebidas. A nota e os comentários aparecem aqui assim que o instrutor liberar."}
              </p>
              <Link className="mb-btn is-ghost" to="/minha-area/atividades">Voltar às atividades</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
