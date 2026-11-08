import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ResultReview from "../../components/forms/ResultReview";
import { formatDateTime, friendlyFormError, typeLabel } from "../../services/forms";
import { supabase } from "../../services/supabase";
import "../../styles/forms-public.css";

// Resultado de uma prova aberta pelo link público, para quem guardou o link de resultado (sem login).
// O código do link é o segredo: só quem o tem vê as respostas. Nota, gabarito e comentários só aparecem depois da liberação.
export default function PublicResultPage() {
  const { slug, token } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setResult(null);
    supabase.rpc("public_form_get_result", { p_token: token }).then(({ data, error: rpcError }) => {
      if (!alive) return;
      if (rpcError) setError(/não encontrado/i.test(rpcError.message || "") ? "Este link de resultado não é válido. Confira se ele foi copiado por inteiro." : friendlyFormError(rpcError));
      else setResult(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) return <main className="pf-state">Carregando...</main>;

  if (error) {
    return (
      <main className="pf-state">
        <h1>Resultado não encontrado</h1>
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main className="pf-page">
      <div className="pf-shell">
        <header className="pf-hero">
          <span>{typeLabel(result.form.type)}</span>
          <h1>{result.form.title}</h1>
          <p>
            {result.respondent_name ? `${result.respondent_name} · ` : ""}enviada em {formatDateTime(result.submitted_at)}
          </p>
        </header>

        {result.released ? (
          <ResultReview result={result} />
        ) : (
          <div className="pf-success">
            <h1>{result.pending_manual ? "Aguardando a correção" : "Aguardando a liberação"}</h1>
            <p>
              {result.release_mode === "date" && result.release_at
                ? `Sua nota e os comentários ficam disponíveis em ${formatDateTime(result.release_at)}.`
                : "Suas respostas foram recebidas. A nota e os comentários aparecem aqui quando o instrutor liberar."}
            </p>
            <p className="pf-hint">Guarde este link e volte depois: ele mostra o resultado assim que for liberado.</p>
          </div>
        )}

        <p className="pf-back"><Link to={`/f/${slug}`}>Voltar à prova</Link></p>
      </div>
    </main>
  );
}
