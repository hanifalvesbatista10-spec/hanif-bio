import { formatScore, hasOptions, isQuestion, percent } from "../../services/forms";
import "../../styles/forms-run.css";

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const asList = (value) => (Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value]);

function statusChip(item) {
  if (item.annulled) return { tone: "is-ok", label: "Anulada: todos ganham o ponto" };
  if (item.needs_review) return { tone: "is-wait", label: "Aguardando correção" };
  if (item.is_correct === true) return { tone: "is-ok", label: "Correta" };
  if (item.is_correct === false) return Number(item.points_awarded) > 0 ? { tone: "is-part", label: "Parcialmente correta" } : { tone: "is-bad", label: "Incorreta" };
  if (Number(item.points_awarded) > 0) return { tone: "is-part", label: "Nota dada pelo instrutor" };
  return null;
}

function Answer({ item }) {
  const mine = asList(item.answer);
  const correct = asList(item.correct);
  const hasKey = correct.length > 0;

  if (hasOptions(item.type) || item.type === "true_false" || item.type === "yes_no") {
    const options = item.options || [];
    return (
      <ul className="fx-opt-list">
        {options.map((option) => {
          const isMine = mine.some((value) => norm(value) === norm(option));
          const isRight = hasKey && correct.some((value) => norm(value) === norm(option));
          return (
            <li key={option} className={`${isMine ? "is-mine" : ""} ${isRight ? "is-right" : ""} ${isMine && hasKey && !isRight ? "is-wrong" : ""}`}>
              <span>{option}</span>
              <em>{[isMine && "Sua resposta", isRight && "Resposta certa"].filter(Boolean).join(" · ")}</em>
            </li>
          );
        })}
      </ul>
    );
  }

  if (item.type === "file") {
    return <div className="fx-answer-box"><small>Seu arquivo</small>{item.answer?.name || "Nenhum arquivo enviado"}</div>;
  }

  return (
    <>
      <div className="fx-answer-box">
        <small>Sua resposta</small>
        {mine.length ? mine.join(", ") : "Em branco"}
      </div>
      {hasKey && (
        <div className="fx-answer-box">
          <small>{correct.length > 1 ? "Respostas aceitas" : "Resposta esperada"}</small>
          {correct.join(" / ")}
        </div>
      )}
    </>
  );
}

// Revisão do resultado de uma tentativa, como o aluno vê depois da liberação.
export default function ResultReview({ result }) {
  const pct = percent(result.score, result.max_score);
  let number = 0;

  return (
    <div className="fx-review">
      <section className="fx-review-top" aria-label="Resultado">
        {Number(result.max_score) > 0 ? (
          <div className="fx-score">
            <strong>{formatScore(result.score)} / {formatScore(result.max_score)}</strong>
            <small>{pct}% de aproveitamento</small>
          </div>
        ) : (
          <div className="fx-score"><strong>Enviado</strong><small>Esta atividade não tem nota</small></div>
        )}
        {result.passed === true && <span className="fx-verdict is-pass">Aprovado</span>}
        {result.passed === false && <span className="fx-verdict is-fail">Abaixo da nota mínima ({formatScore(result.form?.pass_score)}%)</span>}
        {result.instructor_feedback && <p className="fx-feedback">{result.instructor_feedback}</p>}
      </section>

      {!result.key_shown && (
        <p className="fx-hint" style={{ margin: "0 0 14px" }}>
          O gabarito e os comentários aparecem quando você usar todas as tentativas desta atividade.
        </p>
      )}

      {result.items.map((item) => {
        if (!isQuestion(item.type)) {
          if (item.type === "heading") return <h2 key={item.block_id} style={{ margin: "22px 4px 10px", fontFamily: "var(--font-display, Inter, sans-serif)" }}>{item.title}</h2>;
          return null;
        }
        number += 1;
        const chip = statusChip(item);
        return (
          <article className="fx-review-item" key={item.block_id}>
            <div className="fx-review-head">
              <span>Questão {number}</span>
              {chip && <span className={`fx-chip ${chip.tone}`}>{chip.label}</span>}
              {Number(item.points) > 0 && <span className="fx-pts">{formatScore(item.points_awarded)} / {formatScore(item.points)} pts</span>}
            </div>
            <h3>{item.title}</h3>
            {item.image_url && <img className="fx-qimage" src={item.image_url} alt="" />}
            <Answer item={item} />
            {item.instructor_feedback && (
              <div className="fx-explain" style={{ marginBottom: 10 }}>
                <strong>Comentário do instrutor</strong>
                {item.instructor_feedback}
              </div>
            )}
            {(item.explanation || item.explanation_image_url) && (
              <div className="fx-explain">
                <strong>Comentário da questão</strong>
                {item.explanation}
                {item.explanation_image_url && <img src={item.explanation_image_url} alt="" />}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
