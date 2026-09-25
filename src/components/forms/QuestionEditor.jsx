import RowActions from "../admin/RowActions";
import { BLOCK_TYPES, blockLabel, canHavePoints, hasOptions, isManualType, isQuestion } from "../../services/forms";
import { hasKey } from "../../services/formsImport";

const GROUPS = ["Objetivas", "Você corrige", "Pesquisa", "Conteúdo"];

export function questionProblem(block) {
  if (isQuestion(block.type) && !block.title.trim()) return "Falta o enunciado.";
  if (!isQuestion(block.type) && block.type !== "image" && !block.title.trim() && !block.description.trim()) return "Falta o texto.";
  if (hasOptions(block.type) && block.options.filter((option) => option.trim()).length < 2) return "Coloque ao menos 2 alternativas.";
  if (canHavePoints(block.type) && Number(block.points) > 0 && !isManualType(block.type) && !hasKey(block)) return "Marque a resposta correta.";
  if (block.type === "number" && String(block.number_value).trim() !== "" && Number.isNaN(Number(String(block.number_value).replace(",", ".")))) return "O valor correto precisa ser um número.";
  return "";
}

function OptionsEditor({ block, onChange }) {
  const multi = block.type === "multi_choice";
  const setOption = (index, value) => onChange({ options: block.options.map((option, i) => (i === index ? value : option)) });
  const remove = (index) => {
    const options = block.options.filter((_, i) => i !== index);
    const correct_set = block.correct_set.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));
    const correct_idx = block.correct_idx === index ? -1 : block.correct_idx > index ? block.correct_idx - 1 : block.correct_idx;
    onChange({ options, correct_set, correct_idx });
  };
  const toggle = (index) => {
    if (multi) {
      onChange({ correct_set: block.correct_set.includes(index) ? block.correct_set.filter((i) => i !== index) : [...block.correct_set, index] });
    } else {
      onChange({ correct_idx: index });
    }
  };
  const isRight = (index) => (multi ? block.correct_set.includes(index) : block.correct_idx === index);

  return (
    <div className="fa-options">
      <p className="fa-help">{multi ? "Marque todas as alternativas corretas." : "Marque a alternativa correta."}</p>
      {block.options.map((option, index) => (
        <div className={`fa-option${isRight(index) ? " is-right" : ""}`} key={index}>
          <input
            type={multi ? "checkbox" : "radio"}
            name={`correct-${block.id}`}
            checked={isRight(index)}
            onChange={() => toggle(index)}
            aria-label={`Alternativa ${String.fromCharCode(65 + index)} é correta`}
          />
          <span className="fa-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
          <input className="fa-input" value={option} onChange={(event) => setOption(index, event.target.value)} placeholder={`Alternativa ${String.fromCharCode(65 + index)}`} aria-label={`Texto da alternativa ${String.fromCharCode(65 + index)}`} />
          <button type="button" className="fa-icon-btn" onClick={() => remove(index)} disabled={block.options.length <= 2} aria-label="Remover alternativa">×</button>
        </div>
      ))}
      <button type="button" className="fa-link-btn" onClick={() => onChange({ options: [...block.options, ""] })} disabled={block.options.length >= 8}>+ Adicionar alternativa</button>
      {multi && (
        <label className="fa-check">
          <input type="checkbox" checked={block.partial_credit} onChange={(event) => onChange({ partial_credit: event.target.checked })} />
          Dar nota parcial (cada acerto vale uma parte, cada erro desconta uma parte)
        </label>
      )}
    </div>
  );
}

function AnswerEditor({ block, onChange }) {
  if (hasOptions(block.type)) return <OptionsEditor block={block} onChange={onChange} />;

  if (block.type === "true_false" || block.type === "yes_no") {
    const choices = block.type === "true_false" ? ["Verdadeiro", "Falso"] : ["Sim", "Não"];
    return (
      <div className="fa-options">
        <p className="fa-help">Resposta correta:</p>
        <div className="fa-seg" role="radiogroup" aria-label="Resposta correta">
          {choices.map((choice) => (
            <button key={choice} type="button" role="radio" aria-checked={block.tf === choice} className={block.tf === choice ? "is-active" : ""} onClick={() => onChange({ tf: choice })}>{choice}</button>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "short_text") {
    return (
      <label className="fa-field">
        <span>Respostas aceitas (uma por linha)</span>
        <textarea className="fa-input" rows={3} value={block.accepted_text} onChange={(event) => onChange({ accepted_text: event.target.value })} placeholder={"DEA\nDesfibrilador externo automático"} />
        <small>Não faz diferença entre maiúsculas, minúsculas e acentos. Coloque as variações que você aceita.</small>
      </label>
    );
  }

  if (block.type === "number") {
    return (
      <div className="fa-grid">
        <label className="fa-field">
          <span>Valor correto</span>
          <input className="fa-input" inputMode="decimal" value={block.number_value} onChange={(event) => onChange({ number_value: event.target.value })} placeholder="Ex.: 75" />
        </label>
        <label className="fa-field">
          <span>Diferença aceita (opcional)</span>
          <input className="fa-input" inputMode="decimal" value={block.tolerance} onChange={(event) => onChange({ tolerance: event.target.value })} placeholder="Ex.: 5 aceita de 70 a 80" />
        </label>
      </div>
    );
  }

  if (isManualType(block.type)) {
    return <p className="fa-note">Esta pergunta é corrigida por você: as respostas aparecem em <strong>Resultados</strong> para dar a nota e um comentário. Se colocar 0 pontos, ela só coleta a resposta.</p>;
  }
  return null;
}

// Editor de uma pergunta (ou bloco de conteúdo) do construtor de provas.
export default function QuestionEditor({ block, index, total, number, open, onToggle, onChange, onMove, onDuplicate, onRemove, onUploadImage }) {
  const question = isQuestion(block.type);
  const problem = questionProblem(block);
  const setType = (type) => {
    const base = { type };
    if (hasOptions(type) && block.options.length < 2) base.options = ["", ""];
    if (!hasOptions(type)) base.options = [];
    if (!canHavePoints(type)) base.points = 0;
    else if (!canHavePoints(block.type)) base.points = 1;
    onChange({ ...base, correct_idx: -1, correct_set: [], tf: "" });
  };

  return (
    <article className={`fa-q${open ? " is-open" : ""}${problem ? " has-problem" : ""}`}>
      <header className="fa-q-head">
        <button type="button" className="fa-q-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="fa-q-num">{question ? number : "•"}</span>
          <span className="fa-q-title">{block.title.trim() || block.description.trim() || <em>Sem enunciado</em>}</span>
          <span className="fa-q-meta">
            {blockLabel(block.type)}
            {canHavePoints(block.type) && Number(block.points) > 0 ? ` · ${Number(block.points)} pt` : ""}
          </span>
          {problem && <span className="fa-q-flag">{problem}</span>}
          {block.annulled && <span className="fa-q-flag is-info">Anulada</span>}
        </button>
        <RowActions
          label={`Ações da pergunta ${index + 1}`}
          items={[
            { label: "Mover para cima", onClick: () => onMove(-1), disabled: index === 0 },
            { label: "Mover para baixo", onClick: () => onMove(1), disabled: index === total - 1 },
            { label: "Duplicar pergunta", onClick: onDuplicate },
            { label: "Excluir pergunta", danger: true, onClick: onRemove },
          ]}
        />
      </header>

      {open && (
        <div className="fa-q-body">
          <div className="fa-grid">
            <label className="fa-field">
              <span>Tipo</span>
              <select className="fa-input" value={block.type} onChange={(event) => setType(event.target.value)}>
                {GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {BLOCK_TYPES.filter((item) => item.group === group).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {canHavePoints(block.type) && (
              <label className="fa-field">
                <span>Pontos</span>
                <input className="fa-input" type="number" min="0" step="0.5" value={block.points} onChange={(event) => onChange({ points: event.target.value })} />
              </label>
            )}
            {question && (
              <label className="fa-field">
                <span>Tema (opcional)</span>
                <input className="fa-input" value={block.topic} onChange={(event) => onChange({ topic: event.target.value })} placeholder="Ex.: RCP, Trauma" />
              </label>
            )}
          </div>

          <label className="fa-field">
            <span>{question ? "Enunciado" : block.type === "heading" ? "Título" : "Título (opcional)"}</span>
            <textarea className="fa-input" rows={question ? 3 : 2} value={block.title} onChange={(event) => onChange({ title: event.target.value })} />
          </label>

          <label className="fa-field">
            <span>{question ? "Contexto ou orientação (opcional)" : "Texto"}</span>
            <textarea className="fa-input" rows={2} value={block.description} onChange={(event) => onChange({ description: event.target.value })} />
          </label>

          <div className="fa-field">
            <span>Imagem (opcional)</span>
            <div className="fa-image-row">
              <input type="file" accept="image/*" onChange={(event) => onUploadImage(event.target.files?.[0], "image_url")} />
              {block.image_url && (
                <>
                  <img src={block.image_url} alt="" />
                  <button type="button" className="fa-link-btn" onClick={() => onChange({ image_url: "" })}>Remover imagem</button>
                </>
              )}
            </div>
          </div>

          {question && <AnswerEditor block={block} onChange={onChange} />}

          {question && block.type !== "scale" && (
            <div className="fa-feedback">
              <label className="fa-field">
                <span>{isManualType(block.type) ? "Resposta esperada ou critérios (o aluno vê depois da liberação)" : "Comentário da questão (o aluno vê depois da liberação)"}</span>
                <textarea className="fa-input" rows={3} value={block.feedback} onChange={(event) => onChange({ feedback: event.target.value })} placeholder="Explique por que a resposta é essa." />
              </label>
              <div className="fa-image-row">
                <input type="file" accept="image/*" onChange={(event) => onUploadImage(event.target.files?.[0], "feedback_image_url")} aria-label="Imagem do comentário" />
                {block.feedback_image_url && (
                  <>
                    <img src={block.feedback_image_url} alt="" />
                    <button type="button" className="fa-link-btn" onClick={() => onChange({ feedback_image_url: "" })}>Remover imagem</button>
                  </>
                )}
              </div>
            </div>
          )}

          {question && (
            <div className="fa-flags">
              <label className="fa-check">
                <input type="checkbox" checked={block.required} onChange={(event) => onChange({ required: event.target.checked })} />
                Resposta obrigatória
              </label>
              {canHavePoints(block.type) && (
                <label className="fa-check">
                  <input type="checkbox" checked={block.annulled} onChange={(event) => onChange({ annulled: event.target.checked })} />
                  Anular questão (todos ganham os pontos)
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
