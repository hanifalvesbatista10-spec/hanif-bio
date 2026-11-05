import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, isQuestion, seededShuffle, uploadAnswerFile } from "../../services/forms";
import useExamGuard from "./useExamGuard";
import "../../styles/forms-run.css";

const emptyValue = (value) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

// Responde uma prova, atividade ou pesquisa. Serve para o formulário público e para as provas dos alunos.
// Prova pública com tempo ou modo prova passa por uma tela de início (PublicFormPage): ela entrega startedAtMs (quando a pessoa
// começou) e presetIdentity (nome e e-mail já informados lá). O tempo e o rascunho sobrevivem a recarregar a página.
export default function FormRunner({ form, blocks, mode = "public", userId, submission, onSubmit, sending, error, startedAtMs = null, presetIdentity = null }) {
  const student = mode === "student";
  const exam = Boolean(form.settings?.exam_mode);
  const guarded = !student && Boolean(startedAtMs); // prova pública que começou na tela de início
  const draftKey = student && submission?.id ? `fx-draft-${submission.id}` : guarded ? `fx-draft-pub-${form.id}` : null;
  const examKey = student ? submission?.id : guarded ? `pub-${form.id}` : null;
  const [answers, setAnswers] = useState(() => {
    if (!draftKey) return {};
    try {
      return JSON.parse(window.localStorage.getItem(draftKey) || "{}");
    } catch {
      return {};
    }
  });
  const [identity, setIdentity] = useState(presetIdentity || { name: "", email: "" });
  const [trap, setTrap] = useState(""); // campo invisível: só robô preenche
  const [localError, setLocalError] = useState("");
  const [invalidId, setInvalidId] = useState("");
  const [uploading, setUploading] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const sentRef = useRef(false);
  const finishRef = useRef(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const guard = useExamGuard({
    enabled: exam && Boolean(examKey),
    storageKey: examKey,
    maxExits: form.settings?.exam_max_exits,
    onLimit: () => finishRef.current?.(true, true),
  });
  const guardRef = useRef(guard);
  guardRef.current = guard;
  const autoTriedRef = useRef(false);

  // guarda o rascunho no aparelho (a tentativa continua valendo se a página recarregar)
  useEffect(() => {
    if (!draftKey) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
  }, [answers, draftKey]);

  const shuffleSeed = useMemo(() => {
    if (student) return submission?.id || "";
    if (startedAtMs) return String(startedAtMs);
    try {
      const key = `fx-seed-${form.id}`;
      let seed = window.sessionStorage.getItem(key);
      if (!seed) {
        seed = String(Math.random()).slice(2);
        window.sessionStorage.setItem(key, seed);
      }
      return seed;
    } catch {
      return "fixa";
    }
  }, [student, submission?.id, startedAtMs, form.id]);

  const items = useMemo(() => {
    let list = blocks;
    if (form.shuffle_questions) {
      const positions = list.map((block, index) => (isQuestion(block.type) ? index : -1)).filter((index) => index >= 0);
      const shuffled = seededShuffle(positions.map((index) => list[index]), `${shuffleSeed}-q`);
      list = list.map((block, index) => {
        const slot = positions.indexOf(index);
        return slot >= 0 ? shuffled[slot] : block;
      });
    }
    let number = 0;
    return list.map((block) => {
      let options = block.options || [];
      if (form.shuffle_options && (block.type === "choice" || block.type === "multi_choice")) {
        options = seededShuffle(options, `${shuffleSeed}-${block.id}`);
      }
      return { block, options, number: isQuestion(block.type) ? (number += 1) : null };
    });
  }, [blocks, form.shuffle_questions, form.shuffle_options, shuffleSeed]);

  const limitMinutes = Number(form.time_limit_minutes) || 0;
  const deadline = student
    ? submission?.deadline_at ? new Date(submission.deadline_at).getTime() : null
    : startedAtMs && limitMinutes > 0 ? startedAtMs + limitMinutes * 60000 : null;
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
    async (auto = false, endedByExits = false) => {
      if (sentRef.current) return;
      sentRef.current = true;
      const ok = await onSubmit(buildPayload(), { identity, auto, exam: exam ? guardRef.current.snapshot(endedByExits) : undefined });
      if (ok === false) sentRef.current = false;
      else {
        if (exam) guardRef.current.finish();
        if (draftKey) {
          try {
            window.localStorage.removeItem(draftKey);
          } catch {
            /* ignora */
          }
        }
      }
    },
    [buildPayload, draftKey, identity, onSubmit, exam]
  );
  finishRef.current = finish;

  // cronômetro
  useEffect(() => {
    if (!deadline) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  // acabou o tempo: envia uma vez só (se o envio falhar, a pessoa vê o erro; não fica tentando sem parar)
  useEffect(() => {
    if (deadline && remaining === 0 && !autoTriedRef.current) {
      autoTriedRef.current = true;
      finish(true);
    }
  }, [deadline, remaining, finish]);

  // avisa antes de sair da página com respostas em andamento
  useEffect(() => {
    if (!student && !guarded) return undefined;
    const warn = (event) => {
      if (sentRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [student, guarded]);

  const submit = async (event) => {
    event.preventDefault();
    if (trap) return; // robô: não envia nem avisa
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
    if (student && blank > 0) {
      guard.suppress(60000); // a caixa de confirmação tira o foco da página; não é saída
      const proceed = window.confirm(`Você deixou ${blank} ${blank === 1 ? "questão" : "questões"} em branco. Enviar mesmo assim?`);
      guard.suppress(0);
      if (!proceed) return;
    }
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
                <input type="file" onClick={() => guard.suppress(120000)} onChange={(e) => { guard.suppress(0); onFile(block, e.target.files?.[0]); }} disabled={uploading === block.id} />
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

  // modo prova: sem copiar, recortar, arrastar nem menu de contexto no enunciado (nos campos de resposta continua normal)
  const blockCopy = (event) => {
    if (!exam || /^(INPUT|TEXTAREA)$/.test(event.target?.tagName || "")) return;
    event.preventDefault();
  };

  return (
    <form
      className={`fx${exam ? " fx-exam" : ""}`}
      onSubmit={submit}
      noValidate
      onCopy={blockCopy}
      onCut={blockCopy}
      onContextMenu={blockCopy}
      onDragStart={blockCopy}
    >
      {guard.overlay && (
        <div className="fx-guard" role="alertdialog" aria-modal="true" aria-labelledby="fx-guard-title">
          <div className="fx-guard-box">
            <h2 id="fx-guard-title">{guard.overlay.reached ? "Prova encerrada" : "Você saiu da prova"}</h2>
            {guard.overlay.reached ? (
              <p>Você saiu da tela {guard.limit} vezes, e esse é o limite. As suas respostas estão sendo enviadas.</p>
            ) : (
              <>
                <p>Essa saída foi registrada (<strong>{guard.exits} de {guard.limit}</strong>). O tempo continuou correndo.</p>
                <p>Na saída número {guard.limit}, a prova é encerrada e enviada com o que já estiver respondido.</p>
                <button type="button" className="fx-submit" onClick={guard.dismiss}>Voltar para a prova</button>
              </>
            )}
          </div>
        </div>
      )}

      {remaining !== null && (
        <div className={`fx-timer${lowTime ? " is-low" : ""}`} role="timer" aria-live="off">
          <span>Tempo restante</span>
          <strong>{formatDuration(remaining)}</strong>
        </div>
      )}

      {!student && !presetIdentity && (form.settings?.require_name || form.settings?.require_email) && (
        <section className="fx-card">
          <h2>Identificação</h2>
          <div className="fx-id">
            {form.settings?.require_name && (
              <label><span>Nome *</span><input className="fx-input" value={identity.name} onChange={(e) => setIdentity((v) => ({ ...v, name: e.target.value }))} autoComplete="name" /></label>
            )}
            {form.settings?.require_email && (
              <label><span>E-mail *</span><input className="fx-input" type="email" value={identity.email} onChange={(e) => setIdentity((v) => ({ ...v, email: e.target.value }))} autoComplete="email" /></label>
            )}
            <div className="fx-trap" aria-hidden="true">
              <label>Não preencha este campo<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
            </div>
          </div>
          {form.settings?.data_controller && (
            <p className="fx-notice">
              Seus dados (nome, e-mail e respostas) serão usados por <strong>{form.settings.data_controller}</strong> para acompanhar o aprendizado.
              Saiba mais na <a href="/privacidade" target="_blank" rel="noopener noreferrer">política de privacidade</a>.
            </p>
          )}
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
