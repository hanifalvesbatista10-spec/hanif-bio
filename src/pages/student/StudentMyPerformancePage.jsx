import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import { formatDateTime, friendlyFormError } from "../../services/forms";
import { supabase } from "../../services/supabase";

const WEAK = 60;
const STRONG = 80;

export function ActivityTabs({ current }) {
  return (
    <div className="mb-tabs" role="navigation" aria-label="Atividades e desempenho">
      <Link className={`mb-tabs-btn${current === "activities" ? " is-active" : ""}`} to="/minha-area/atividades" aria-current={current === "activities" ? "page" : undefined}>Atividades</Link>
      <Link className={`mb-tabs-btn${current === "performance" ? " is-active" : ""}`} to="/minha-area/desempenho" aria-current={current === "performance" ? "page" : undefined}>Meu desempenho</Link>
    </div>
  );
}

const tone = (percent) => (percent === null ? "is-few" : percent < WEAK ? "is-weak" : percent < STRONG ? "is-mid" : "is-strong");

function Bar({ percent }) {
  return (
    <div className={`mb-bar ${tone(percent)}`} role="img" aria-label={percent === null ? "sem dados" : `${percent}%`}>
      <span style={{ width: `${percent ?? 0}%` }} />
    </div>
  );
}

// "Meu desempenho": onde o aluno vai bem, onde vale reforçar e qual aula rever. Só conta resultados já liberados.
export default function StudentMyPerformancePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("my_performance").then(({ data: result, error: rpcError }) => {
      if (rpcError) setError(/does not exist|PGRST202|my_performance/i.test(rpcError.message) ? "Este recurso ainda não está ativo. Avise a equipe." : friendlyFormError(rpcError));
      else setData(result);
      setLoading(false);
    });
  }, []);

  const overall = data?.overall;
  const strong = (data?.topics || []).filter((topic) => topic.answered >= 3 && topic.percent !== null && topic.percent >= STRONG).slice(-5).reverse();

  return (
    <div className="mb-page is-narrow">
      <div className="mb-page-head">
        <h1>Meu desempenho</h1>
        <p>Onde você vai bem e onde vale reforçar. Conta só as provas que já tiveram o resultado liberado.</p>
      </div>
      <ActivityTabs current="performance" />

      {error && <div className="mb-alert is-error" role="alert">{error}</div>}

      {loading ? (
        <div className="mb-card" aria-busy="true"><i className="mb-skel-line" /></div>
      ) : !error && overall.attempts === 0 ? (
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.activities}</span>
          <h2>Ainda não há resultados por aqui</h2>
          <p>Quando você fizer uma prova, um simulado ou uma tarefa e o instrutor liberar o resultado, aparece aqui em quais assuntos você vai bem e em quais vale reforçar.</p>
          <Link className="mb-btn" to="/minha-area/atividades">Ver minhas atividades</Link>
        </div>
      ) : data ? (
        <>
          <div className="mb-stats">
            <div className="mb-stat"><strong>{overall.avg === null ? "—" : `${overall.avg}%`}</strong><span>média nas provas</span></div>
            <div className="mb-stat"><strong>{overall.attempts}</strong><span>{overall.attempts === 1 ? "envio com resultado" : "envios com resultado"}</span></div>
            <div className="mb-stat"><strong>{overall.passed}</strong><span>{overall.passed === 1 ? "aprovação" : "aprovações"}</span></div>
          </div>

          <section className="mb-card" aria-labelledby="weak-title">
            <div className="mb-card-head">
              <h2 id="weak-title">Vale reforçar</h2>
              <p>
                {data.weak.length === 0
                  ? "Nenhum assunto abaixo de 60% por enquanto. Continue assim!"
                  : "Assuntos em que você acertou menos de 60%. Comece pelos primeiros."}
              </p>
            </div>
            {data.weak.length > 0 && (
              <ul className="mb-weak">
                {data.weak.map((item) => (
                  <li key={`${item.topic}-${item.subtopic || ""}`}>
                    <div className="mb-weak-head">
                      <strong>{item.topic}{item.subtopic ? ` › ${item.subtopic}` : ""}</strong>
                      <span>{item.percent}%</span>
                    </div>
                    <Bar percent={item.percent} />
                    <p>Você acertou {item.percent}% das questões deste assunto ({item.answered} {item.answered === 1 ? "resposta" : "respostas"}).</p>
                    {item.lessons.length > 0 ? (
                      <div className="mb-weak-lessons">
                        <span>Para rever:</span>
                        {item.lessons.map((lesson) => (
                          <Link key={lesson.id} className="mb-btn is-ghost is-small" to={`/minha-area/curso/${lesson.product_id}?aula=${lesson.id}`}>{icons.play} {lesson.title}</Link>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-weak-hint">Quer ajuda com este assunto? Fale com o instrutor.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {strong.length > 0 && (
            <section className="mb-card" aria-labelledby="strong-title">
              <div className="mb-card-head">
                <h2 id="strong-title">Seus pontos fortes</h2>
                <p>Assuntos em que você acertou 80% ou mais.</p>
              </div>
              <ul className="mb-chips">
                {strong.map((topic) => <li key={topic.topic}><strong>{topic.topic}</strong> {topic.percent}%</li>)}
              </ul>
            </section>
          )}

          <section className="mb-card" aria-labelledby="all-title">
            <div className="mb-card-head">
              <h2 id="all-title">Todos os assuntos</h2>
              {overall.last && <p>Último resultado: {formatDateTime(overall.last)}.</p>}
            </div>
            <ul className="mb-topics">
              {data.topics.map((topic) => (
                <li key={topic.topic}>
                  <div className="mb-topic-row">
                    <strong>{topic.topic}</strong>
                    <Bar percent={topic.percent} />
                    <span>{topic.percent === null ? "—" : `${topic.percent}%`}</span>
                  </div>
                  {topic.subtopics.length > 0 && (
                    <ul className="mb-subtopics">
                      {topic.subtopics.map((sub) => (
                        <li key={sub.subtopic} className="mb-topic-row is-sub">
                          <span>{sub.subtopic}</span>
                          <Bar percent={sub.percent} />
                          <span>{sub.percent === null ? "—" : `${sub.percent}%`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
