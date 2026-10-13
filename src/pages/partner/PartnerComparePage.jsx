import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { buildCsv } from "../../services/finance";
import { comparePrePost } from "../../services/prePost";

const pct = (value) => (value === null || value === undefined ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const points = (value) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pontos`);
const STATUS = {
  both: "Fez os dois",
  only_pre: "Só o pré-teste",
  only_post: "Só o pós-teste",
  pending: "Aguardando correção",
};

// Compara o pré-teste e o pós-teste do mesmo aluno (reconhecido pelo e-mail): nota do pré, do pós e o ganho.
export default function PartnerComparePage() {
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [preId, setPreId] = useState("");
  const [postId, setPostId] = useState("");
  const [submissions, setSubmissions] = useState({ pre: [], post: [] });
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("forms")
      .select("id,title,status,created_at")
      .eq("created_by", user.id) // só as provas dele (provas públicas de outras pessoas também são legíveis)
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (loadError) setError(`Não foi possível carregar as provas: ${loadError.message}`);
        else setForms(data || []);
        setLoadingForms(false);
      });
  }, [user]);

  const sameForm = Boolean(preId) && preId === postId;

  useEffect(() => {
    if (!preId || !postId || preId === postId) {
      setSubmissions({ pre: [], post: [] });
      return;
    }
    let active = true;
    setLoadingData(true);
    setError("");
    supabase
      .from("form_submissions")
      .select("id,form_id,respondent_name,respondent_email,score,max_score,status,pending_manual,submitted_at")
      .in("form_id", [preId, postId])
      .neq("status", "in_progress")
      .limit(5000)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(`Não foi possível carregar as respostas: ${loadError.message}`);
        else setSubmissions({ pre: (data || []).filter((row) => row.form_id === preId), post: (data || []).filter((row) => row.form_id === postId) });
        setLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [preId, postId]);

  const result = useMemo(() => comparePrePost(submissions.pre, submissions.post), [submissions]);
  const { rows, summary } = result;
  const ready = Boolean(preId && postId && !sameForm);

  const exportCsv = () => {
    const csv = buildCsv(
      ["Nome", "E-mail", "Pré (%)", "Pós (%)", "Ganho (pontos percentuais)", "Situação"],
      rows.map((row) => [row.name, row.email, row.pre ?? "", row.post ?? "", row.gain ?? "", STATUS[row.status]])
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pre-e-pos-teste-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>RESULTADOS</span>
          <h2>Comparar pré e pós-teste</h2>
        </div>
        {ready && rows.length > 0 && <button type="button" className="admin-button" onClick={exportCsv}>Exportar planilha (CSV)</button>}
      </div>

      <p className="adm-hint">
        Escolha qual prova é o pré-teste e qual é o pós-teste. O mesmo aluno é reconhecido pelo <strong>e-mail</strong> que ele digitou nas duas provas.
        A nota de cada uma vira porcentagem, e o ganho é a diferença entre o pós e o pré.
      </p>

      {error && <div className="admin-alert error" role="alert">{error}</div>}

      {loadingForms ? (
        <div className="admin-empty">Carregando...</div>
      ) : forms.length < 2 ? (
        <div className="admin-empty">Crie pelo menos duas provas (o pré e o pós-teste) em “Minhas provas” para poder compará-las.</div>
      ) : (
        <div className="pt-compare-pick">
          <label>Pré-teste
            <select value={preId} onChange={(e) => setPreId(e.target.value)}>
              <option value="">Escolha a prova</option>
              {forms.map((form) => <option key={form.id} value={form.id}>{form.title}{form.status === "published" ? "" : " (rascunho)"}</option>)}
            </select>
          </label>
          <label>Pós-teste
            <select value={postId} onChange={(e) => setPostId(e.target.value)}>
              <option value="">Escolha a prova</option>
              {forms.map((form) => <option key={form.id} value={form.id}>{form.title}{form.status === "published" ? "" : " (rascunho)"}</option>)}
            </select>
          </label>
        </div>
      )}

      {sameForm && <div className="admin-alert error" role="alert">O pré e o pós-teste precisam ser provas diferentes.</div>}

      {ready && (loadingData ? (
        <div className="admin-empty">Carregando respostas...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">Ainda não há respostas nessas duas provas.</div>
      ) : (
        <>
          <div className="ord-stats">
            <div><strong>{summary.bothCount}</strong><span>alunos fizeram os dois testes</span></div>
            <div><strong>{pct(summary.preAverage)}</strong><span>média no pré-teste</span></div>
            <div><strong>{pct(summary.postAverage)}</strong><span>média no pós-teste</span></div>
            <div>
              <strong className={summary.gainAverage > 0 ? "pt-gain-up" : summary.gainAverage < 0 ? "pt-gain-down" : ""}>{points(summary.gainAverage)}</strong>
              <span>ganho médio</span>
            </div>
            <div><strong>{summary.improved}</strong><span>{summary.improved === 1 ? "melhorou" : "melhoraram"} ({summary.same} {summary.same === 1 ? "igual" : "iguais"}, {summary.worse} {summary.worse === 1 ? "piorou" : "pioraram"})</span></div>
          </div>
          <p className="adm-hint">
            As médias e o ganho contam só quem fez os dois testes ({summary.bothCount} de {rows.length} alunos). Quem fez apenas um aparece na lista, sem entrar na conta.
            Resposta que ainda espera correção manual também fica de fora até ser corrigida.
          </p>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Aluno</th><th>Pré</th><th>Pós</th><th>Ganho</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.email}>
                    <td><strong>{row.name || "Sem nome"}</strong><small>{row.email}</small></td>
                    <td>{pct(row.pre)}</td>
                    <td>{pct(row.post)}</td>
                    <td className={row.gain > 0 ? "pt-gain-up" : row.gain < 0 ? "pt-gain-down" : ""}>{points(row.gain)}</td>
                    <td className="pt-muted">{STATUS[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ))}
    </section>
  );
}
