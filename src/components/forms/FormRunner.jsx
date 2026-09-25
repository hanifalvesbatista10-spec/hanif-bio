import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, isQuestion, seededShuffle, uploadAnswerFile } from "../../services/forms";
import "../../styles/forms-run.css";

const emptyValue = (value) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

// Responde uma prova, atividade ou pesquisa. Serve para o formulário público e para as provas dos alunos.
export default function FormRunner({ form, blocks, mode = "public", userId, submission, onSubmit, sending, error }) {
  const student = mode === "student";
  const draftKey = student && submission?.id ? `fx-draft-${submission.id}` : null;
  const [answers, setAnswers] = useState(() => {
    if (!draftKey) return {};
    try {
      return JSON.parse(window.localStorage.getItem(draftKey) || "{}");
    } catch {
      return {};
    }
  });
  const [identity, setIdentity] = useState({ name: "", email: "" });
  const [localError, setLocalError] = useState("");
  const [invalidId, setInvalidId] = useState("");
  const [uploading, setUploading] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const sentRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // guarda o rascunho no aparelho (a tentativa continua valendo se a página recarregar)
  useEffect(() => {
    if (!draftKey) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
  }, [answers, draftKey]);

  const items = useMemo(() => {
    let list = blocks;
    if (student && form.shuffle_questions) {
      const positions = list.map((block, index) => (isQuestion(block.type) ? index : -1)).filter((index) => index >= 0);
      const shuffled = seededShuffle(positions.map((index) => list[index]), `${submission?.id}-q`);
      list = list.map((block, index) => {
        const slot = positions.indexOf(index);
        return slot >= 0 ? shuffled[slot] : block;
      });
    }
    let number = 0;
    return list.map((block) => {
      let options = block.options || [];
      if (student && form.shuffle_options && (block.type === "choice" || block.type === "multi_choice")) {
        options = seededShuffle(options, `${submission?.id}-${block.id}`);
      }
      return { block, options, number: isQuestion(block.type) ? (number += 1) : null };
    });
  }, [blocks, form.shuffle_questions, form.shuffle_options, student, submission?.id]);

  const deadline = student && submission?.deadline_at ? new Date(submission.deadline_at).getTime() : null;
  const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  const setAnswer = (id, value) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    if (invalidId === id) setInvalidId("");
  };

  const buildPayload = useCallback(
    () => blocks.filter((block) => isQuestion(block.type)).map((block) => ({ block_id: block.id, value: answersRef.current[block.id] ?? null })),
    [blocks]
  );

  const finish = useCallback(
    async (auto = false) => {
      if (sentRef.current) return;
      sentRef.current = true;
      const ok = await onSubmit(buildPayload(), { identity, auto });
      if (ok === false) sentRef.current = false;
      else if (draftKey) {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          /* ignora */
        }
      }
    },
    [buildPayload, draftKey, identity, onSubmit]
  );

  // cronômetro
  useEffect(() => {
    if (!deadline) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (deadline && remaining === 0) finish(true);
  }, [deadline, remaining, finish]);

  // avisa antes de sair da página com respostas em andamento
  useEffect(() => {
    if (!student) return undefined;
    const warn = (event) => {
      if (sentRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [student]);

  const submit = async (event) => {
    event.preventDefault();
    setLocalError("");
    const settings = form.settings || {};
    if (!student) {
      if (settings.require_name && !identity.name.trim()) return setLocalError("Informe o seu nome.");
      if (settings.require_email && !identity.email.trim()) return setLocalError("Informe o seu e-mail.");
    }
    for (const { block } of items) {
      if (!block.required || !isQuestion(block.type)) continue;
      if (emptyValue(answers[block.id])) {
        setInvalidId(block.id);
        setLocalError(`Falta responder: ${block.title || "uma pergunta obrigatória"}.`);
        document.getElementById(`fx-${block.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    const blank = blocks.filter((block) => isQuestion(block.type) && emptyValue(answers[block.id])).length;
    if (student && blank > 0 && !window.confirm(`Você deixou ${blank} ${blank === 1 ? "questão" : "questões"} em branco. Enviar mesmo assim?`)) return;
    finish(false);
  };

  const onFile = async (block, file) => {
    if (!file) return;
    setUploading(block.id);
    setLocalError("");
    try {
      setAnswer(block.id, await uploadAnswerFile(form.id, userId, file));
    } catch (uploadError) {
      setLocalError(uploadError.message || "Não foi possível enviar o arquivo.");
    }
    setUploading("");
  };

  const renderField = ({ block, options }) => {
    const value = answers[block.id] ?? "";
    const label = block.title || "Pergunta";
    switch (block.type) {
      case "short_text":
        return <input className="fx-input" value={value} onChange={(e) => setAnswer(block.id, e.target.value)} aria-label={label} autoComplete="off" />;
      case "long_text":
        return <textarea className="fx-input fx-textarea" value={value} onChange={(e) => setAnswer(block.id, e.target.value)} aria-label={label} rows={6} />;
      case "number":
        return <input className="fx-input fx-number" value={value} inputMode="decimal" onChange={(e) => setAnswer(block.id, e.target.value)} aria-label={label} autoComplete="off" />;
      case "choice":
      case "true_false":
      case "yes_no":
        return (
          <div className="fx-options" role="radiogroup" aria-label={label}>
            {options.map((option) => (
              <label key={option} className={value === option ? "is-checked" : ""}>
                <input type="radio" name={block.id} checked={value === option} onChange={() => setAnswer(block.id, option)} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      case "multi_choice": {
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="fx-options" role="group" aria-label={label}>
            <p className="fx-hint">Marque todas as corretas.</p>
            {options.map((option) => (
              <label key={option} className={selected.includes(option) ? "is-checked" : ""}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={(e) => setAnswer(block.id, e.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      }
      case "scale":
        return (
          <div className="fx-scale" role="radiogroup" aria-label={label}>
            {Array.from({ length: 11 }, (_, n) => (
              <button type="button" key={n} role="radio" aria-checked={value === n} className={value === n ? "is-active" : ""} onClick={() => setAnswer(block.id, n)}>{n}</button>
            ))}
          </div>
        );
      case "file":
        return (
          <div className="fx-file">
            {value?.path ? (
              <div className="fx-file-done">
                <span>{value.name}</span>
                <button type="button" onClick={() => setAnswer(block.id, null)}>Trocar arquivo</button>
              </div>
            ) : (
              <label className="fx-file-pick">
                <input type="file" onChange={(e) => onFile(block, e.target.files?.[0])} disabled={uploading === block.id} />
                <span>{uploading === block.id ? "Enviando arquivo..." : "Escolher arquivo"}</span>
              </label>
            )}
            <p className="fx-hint">PDF, imagem, Word ou texto, até 10 MB.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const shownError = localError || error;
  const lowTime = remaining !== null && remaining <= 300;

  return (
    <form className="fx" onSubmit={submit} noValidate>
      {remaining !== null && (
        <div className={`fx-timer${lowTime ? " is-low" : ""}`} role="timer" aria-live="off">
          <span>Tempo restante</span>
          <strong>{formatDuration(remaining)}</strong>
        </div>
      )}

      {!student && (form.settings?.require_name || form.settings?.require_email) && (
        <section className="fx-card">
          <h2>Identificação</h2>
          <div className="fx-id">
            {form.settings?.require_name && (
              <label><span>Nome *</span><input className="fx-input" value={identity.name} onChange={(e) => setIdentity((v) => ({ ...v, name: e.target.value }))} autoComplete="name" /></label>
            )}
            {form.settings?.require_email && (
              <label><span>E-mail *</span><input className="fx-input" type="email" value={identity.email} onChange={(e) => setIdentity((v) => ({ ...v, email: e.target.value }))} autoComplete="email" /></label>
            )}
          </div>
        </section>
      )}

      {items.map((item) => {
        const { block, number } = item;
        if (block.type === "heading") {
          return (
            <section className="fx-heading" key={block.id}>
              <h2>{block.title}</h2>
              {block.description && <p>{block.description}</p>}
              {block.image_url && <img src={block.image_url} alt="" />}
            </section>
          );
        }
        if (block.type === "text" || block.type === "image") {
          return (
            <section className="fx-text" key={block.id}>
              {block.title && <h3>{block.title}</h3>}
              {block.image_url && <img src={block.image_url} alt={block.title || ""} />}
              {block.description && <p>{block.description}</p>}
            </section>
          );
        }
        return (
          <section className={`fx-card${invalidId === block.id ? " is-invalid" : ""}`} key={block.id} id={`fx-${block.id}`}>
            <div className="fx-qhead">
              <span>Questão {number}</span>
              {block.required && <b>Obrigatória</b>}
              {Number(block.points) > 0 && <em>{Number(block.points)} {Number(block.points) === 1 ? "ponto" : "pontos"}</em>}
            </div>
            <h2>{block.title}</h2>
            {block.description && <p className="fx-desc">{block.description}</p>}
            {block.image_url && <img className="fx-qimage" src={block.image_url} alt="" />}
            <div className="fx-field">{renderField(item)}</div>
          </section>
        );
      })}

      {shownError && <div className="fx-error" role="alert">{shownError}</div>}
      <button className="fx-submit" type="submit" disabled={sending || Boolean(uploading)}>
        {sending ? "Enviando..." : student ? "Enviar respostas" : "Enviar"}
      </button>
    </form>
  );
}
