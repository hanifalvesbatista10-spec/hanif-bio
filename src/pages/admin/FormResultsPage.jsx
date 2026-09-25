import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RowActions from "../../components/admin/RowActions";
import { supabase } from "../../services/supabase";
import {
  blockLabel,
  canHavePoints,
  formatDateTime,
  formatScore,
  friendlyFormError,
  isManualType,
  isQuestion,
  percent,
  signedFileUrl,
  submissionState,
  typeLabel,
} from "../../services/forms";
import "../../styles/forms-admin.css";

const norm = (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const isBlank = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

function answerText(answer) {
  if (isBlank(answer)) return "";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object") return answer.name || "";
  return String(answer);
}

function keyText(key) {
  if (!key || key.correct === null || key.correct === undefined) return "";
  return Array.isArray(key.correct) ? key.correct.join(" / ") : String(key.correct);
}

const FILTERS = [
  ["all", "Todos"],
  ["pending", "Para corrigir"],
  ["graded", "Corrigidos"],
  ["released", "Liberados"],
];

export default function FormResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [keys, setKeys] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [tab, setTab] = useState("answers");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    const [{ data: f, error: fe }, { data: b, error: be }, { data: s, error: se }] = await Promise.all([
      supabase.from("forms").select("*").eq("id", id).single(),
      supabase.from("form_blocks").select("*").eq("form_id", id).order("position"),
      supabase.from("form_submissions").select("*").eq("form_id", id).neq("status", "in_progress").order("submitted_at", { ascending: false }),
    ]);
    if (fe || be || se) {
      notify("error", friendlyFormError(fe || be || se));
      setLoading(false);
      return;
    }
    setForm(f);
    setBlocks(b || []);
    setSubmissions(s || []);
    const blockIds = (b || []).map((x) => x.id);
    const { data: k } = blockIds.length ? await supabase.from("form_block_keys").select("*").in("block_id", blockIds) : { data: [] };
    setKeys(Object.fromEntries((k || []).map((x) => [x.block_id, x])));
    const subIds = (s || []).map((x) => x.id);
    if (subIds.length) {
      const { data: a, error: ae } = await supabase.from("form_answers").select("*").in("submission_id", subIds);
      if (ae) notify("error", ae.message);
      else setAnswers(a || []);
    } else setAnswers([]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const questions = useMemo(() => blocks.filter((block) => isQuestion(block.type)), [blocks]);
  const answersBySub = useMemo(() => {
    const map = {};
    answers.forEach((answer) => {
      (map[answer.submission_id] ||= {})[answer.block_id] = answer;
    });
    return map;
  }, [answers]);

  const stats = useMemo(() => {
    const scored = submissions.filter((s) => Number(s.max_score) > 0 && !s.pending_manual);
    const avgPercent = scored.length ? scored.reduce((sum, s) => sum + (Number(s.score || 0) / Number(s.max_score)) * 100, 0) / scored.length : null;
    return {
      total: submissions.length,
      pending: submissions.filter((s) => s.pending_manual).length,
      toRelease: submissions.filter((s) => s.status === "graded" && !s.results_released_at).length,
      avgPercent,
      passed: form?.pass_score !== null && form?.pass_score !== undefined ? submissions.filter((s) => s.passed === true).length : null,
    };
  }, [submissions, form]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return submissions.filter((s) => {
      const state = submissionState(s, form).key;
      if (filter !== "all" && state !== filter) return false;
      return !term || `${s.respondent_name || ""} ${s.respondent_email || ""}`.toLowerCase().includes(term);
    });
  }, [submissions, filter, query, form]);

  const call = async (fn, okText) => {
    setBusy(true);
    setMessage("");
    const { data, error } = await fn();
    setBusy(false);
    if (error) {
      notify("error", friendlyFormError(error));
      return null;
    }
    if (okText) notify("success", typeof okText === "function" ? okText(data) : okText);
    await load();
    return data ?? true;
  };

  const releaseAll = () =>
    call(() => supabase.rpc("form_release_results", { p_form_id: id, p_ids: null }), (n) => `${n} ${n === 1 ? "resultado liberado" : "resultados liberados"} para os alunos.`);
  const release = (ids) => call(() => supabase.rpc("form_release_results", { p_form_id: id, p_ids: ids }), (n) => (n ? "Resultado liberado ao aluno." : "Nada para liberar: corrija todas as questões primeiro."));
  const hide = (ids) => call(() => supabase.rpc("form_hide_results", { p_form_id: id, p_ids: ids }), "Resultado ocultado do aluno.");
  const regrade = () => {
    if (!window.confirm("Recalcular as notas de todos os envios com o gabarito atual? Notas que você deu à mão em discursivas são mantidas.")) return;
    call(() => supabase.rpc("form_regrade", { p_form_id: id }), (n) => `${n} ${n === 1 ? "envio recalculado" : "envios recalculados"}.`);
  };
  const removeSubmission = async (submission) => {
    if (!window.confirm(`Excluir a resposta de ${submission.respondent_name || "esta pessoa"}? Isso devolve a tentativa ao aluno.`)) return;
    await call(() => supabase.from("form_submissions").delete().eq("id", submission.id), "Resposta excluída.");
    if (selectedId === submission.id) setSelectedId(null);
  };

  const exportCsv = () => {
    const header = ["nome", "email", "tentativa", "enviado_em", "nota", "nota_maxima", "percentual", "situacao", "aprovado", ...questions.map((q, i) => `${i + 1}. ${q.title || q.id}`)];
    const rows = submissions.map((s) => {
      const map = answersBySub[s.id] || {};
      return [
        s.respondent_name || "", s.respondent_email || "", s.attempt_number, s.submitted_at || "", s.score ?? "", s.max_score ?? "",
        percent(s.score, s.max_score) ?? "", submissionState(s, form).label, s.passed === null ? "" : s.passed ? "sim" : "não",
        ...questions.map((q) => answerText(map[q.id]?.answer)),
      ];
    });
    const esc = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${form?.slug || "resultados"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <section className="admin-section">Carregando resultados...</section>;
  if (!form) return <section className="admin-section"><div className="fa-alert is-error">{message || "Formulário não encontrado."}</div></section>;

  const selected = submissions.find((s) => s.id === selectedId);
  if (selected) {
    return (
      <SubmissionDetail
        form={form}
        blocks={blocks}
        keys={keys}
        submission={selected}
        answers={answersBySub[selected.id] || {}}
        busy={busy}
        message={message}
        messageType={messageType}
        onBack={() => setSelectedId(null)}
        onNext={() => {
          const next = submissions.find((s) => s.pending_manual && s.id !== selected.id);
          if (next) setSelectedId(next.id);
          else {
            notify("success", "Não há mais respostas para corrigir.");
            setSelectedId(null);
          }
        }}
        onReload={load}
        onRelease={() => release([selected.id])}
        onHide={() => hide([selected.id])}
        notify={notify}
      />
    );
  }

  return (
    <section className="admin-section fa">
      <div className="fa-top">
        <div>
          <h2>{form.title}</h2>
          <p className="fa-sub">{typeLabel(form.type)} · {form.audience === "students" ? "só alunos logados" : "link público"} · resultados</p>
        </div>
        <div className="fa-top-actions">
          <button className="fa-btn is-ghost" type="button" onClick={() => navigate("/admin/formularios")}>Voltar</button>
          <button className="fa-btn is-ghost" type="button" onClick={() => navigate(`/admin/formularios/${id}`)}>Editar prova</button>
          <button className="fa-btn" type="button" disabled={busy || stats.toRelease === 0} onClick={releaseAll}>
            {stats.toRelease > 0 ? `Liberar ${stats.toRelease} ${stats.toRelease === 1 ? "resultado" : "resultados"}` : "Nada para liberar"}
          </button>
          <RowActions
            label="Mais ações"
            items={[
              { label: "Recalcular todas as notas", onClick: regrade, disabled: busy || submissions.length === 0 },
              { label: "Exportar planilha (CSV)", onClick: exportCsv, disabled: submissions.length === 0 },
            ]}
          />
        </div>
      </div>

      {message && <div className={`fa-alert is-${messageType}`} role="status">{message}</div>}

      <div className="fa-stats">
        <div className="fa-stat"><strong>{stats.total}</strong><span>envios</span></div>
        <div className="fa-stat"><strong>{stats.pending}</strong><span>para corrigir</span></div>
        <div className="fa-stat"><strong>{stats.avgPercent === null ? "—" : `${Math.round(stats.avgPercent)}%`}</strong><span>média de aproveitamento</span></div>
        <div className="fa-stat"><strong>{stats.passed === null ? "—" : stats.passed}</strong><span>{stats.passed === null ? "sem nota mínima" : `aprovados (mín. ${formatScore(form.pass_score)}%)`}</span></div>
      </div>

      <div className="fa-toolbar">
        <div className="fa-seg" role="tablist" aria-label="Visão">
          <button type="button" role="tab" aria-selected={tab === "answers"} className={tab === "answers" ? "is-active" : ""} onClick={() => setTab("answers")}>Respostas</button>
          <button type="button" role="tab" aria-selected={tab === "stats"} className={tab === "stats" ? "is-active" : ""} onClick={() => setTab("stats")}>Por questão</button>
        </div>
        {tab === "answers" && (
          <>
            <div className="fa-seg" role="group" aria-label="Filtrar respostas">
              {FILTERS.map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            <input className="fa-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail…" aria-label="Buscar" />
          </>
        )}
      </div>

      {tab === "answers" ? (
        shown.length === 0 ? (
          <div className="admin-empty">{submissions.length === 0 ? "Ainda não há respostas." : "Nada neste filtro."}</div>
        ) : (
          <div className="fa-table-wrap">
            <table className="fa-table">
              <thead>
                <tr><th>Aluno</th><th>Tentativa</th><th>Enviado em</th><th>Nota</th><th>Situação</th><th className="is-end"><span className="ra-th">Ações</span></th></tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const state = submissionState(s, form);
                  const pct = percent(s.score, s.max_score);
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.respondent_name || "Anônimo"}</strong><small>{s.respondent_email || ""}</small></td>
                      <td className="is-num">{s.attempt_number}</td>
                      <td className="is-num">{formatDateTime(s.submitted_at)}</td>
                      <td className="is-num">
                        {Number(s.max_score) > 0 ? `${formatScore(s.score)} / ${formatScore(s.max_score)}` : "—"}
                        {pct !== null && <small>{pct}%{s.pending_manual ? " (parcial)" : ""}</small>}
                      </td>
                      <td>
                        <span className={`fa-pill is-${state.tone}`}>{state.label}</span>
                        {s.passed !== null && s.passed !== undefined && <small><span className={`fa-pill ${s.passed ? "is-published" : "is-bad"}`}>{s.passed ? "Aprovado" : "Reprovado"}</span></small>}
                      </td>
                      <td className="is-end">
                        <RowActions
                          label={`Ações da resposta de ${s.respondent_name || "anônimo"}`}
                          primary={{ label: s.pending_manual ? "Corrigir" : "Ver", onClick: () => setSelectedId(s.id) }}
                          items={[
                            { label: "Liberar ao aluno", hidden: s.status !== "graded" || Boolean(s.results_released_at), onClick: () => release([s.id]) },
                            { label: "Ocultar do aluno", hidden: !s.results_released_at, onClick: () => hide([s.id]) },
                            { label: "Excluir resposta", danger: true, onClick: () => removeSubmission(s) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <QuestionStats questions={questions} keys={keys} answers={answers} total={submissions.length} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
function QuestionStats({ questions, keys, answers, total }) {
  const byBlock = useMemo(() => {
    const map = {};
    answers.forEach((answer) => (map[answer.block_id] ||= []).push(answer));
    return map;
  }, [answers]);

  const topics = useMemo(() => {
    const map = {};
    questions.forEach((q) => {
      if (!q.topic || !(Number(q.points) > 0)) return;
      const list = (byBlock[q.id] || []).filter((a) => !a.needs_review);
      const item = (map[q.topic] ||= { earned: 0, possible: 0 });
      item.earned += list.reduce((sum, a) => sum + Number(a.points_awarded || 0), 0);
      item.possible += list.length * Number(q.points);
    });
    return Object.entries(map).map(([topic, v]) => ({ topic, pct: v.possible ? Math.round((v.earned / v.possible) * 100) : null }));
  }, [questions, byBlock]);

  if (total === 0) return <div className="admin-empty">As estatísticas aparecem quando chegarem as primeiras respostas.</div>;

  return (
    <>
      {topics.length > 0 && (
        <div className="fa-card">
          <h3>Desempenho por tema</h3>
          <div className="fa-bars">
            {topics.map(({ topic, pct }) => (
              <div className="fa-bar" key={topic}>
                <div className="fa-bar-track"><div className="fa-bar-fill" style={{ width: `${pct ?? 0}%` }} /><span className="fa-bar-label">{topic}</span></div>
                <span className="fa-bar-value">{pct === null ? "—" : `${pct}%`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.map((q, index) => {
        const list = byBlock[q.id] || [];
        const key = keys[q.id];
        const graded = canHavePoints(q.type) && Number(q.points) > 0;
        const right = list.filter((a) => a.is_correct === true).length;
        const blank = list.filter((a) => isBlank(a.answer)).length;
        const options = q.options || [];
        const counts = options.map((option) => ({
          option,
          n: list.filter((a) => (Array.isArray(a.answer) ? a.answer : isBlank(a.answer) ? [] : [a.answer]).some((v) => norm(v) === norm(option))).length,
          right: (key?.correct === undefined || key?.correct === null ? [] : Array.isArray(key.correct) ? key.correct : [key.correct]).some((v) => norm(v) === norm(option)),
        }));
        const avgPoints = list.length ? list.reduce((sum, a) => sum + Number(a.points_awarded || 0), 0) / list.length : 0;
        const rate = list.length ? Math.round((right / list.length) * 100) : null;

        return (
          <div className="fa-card" key={q.id}>
            <div className="fa-grade-meta">
              <span>Questão {index + 1} · {blockLabel(q.type)}{q.topic ? ` · ${q.topic}` : ""}</span>
              {graded && !isManualType(q.type) && rate !== null && <span className={`fa-pill ${rate < 40 ? "is-bad" : rate >= 70 ? "is-published" : ""}`}>{rate}% acertaram</span>}
              {graded && isManualType(q.type) && <span className="fa-pill">média {formatScore(avgPoints)} de {formatScore(q.points)}</span>}
              {key?.annulled && <span className="fa-pill">Anulada</span>}
              <span>{list.length} {list.length === 1 ? "resposta" : "respostas"}{blank ? ` · ${blank} em branco` : ""}</span>
            </div>
            <h4 style={{ margin: "0 0 4px", whiteSpace: "pre-line" }}>{q.title}</h4>
            {options.length > 0 && (
              <div className="fa-bars">
                {counts.map(({ option, n, right: isRight }) => (
                  <div className={`fa-bar${isRight ? " is-right" : ""}`} key={option}>
                    <div className="fa-bar-track"><div className="fa-bar-fill" style={{ width: `${list.length ? (n / list.length) * 100 : 0}%` }} /><span className="fa-bar-label">{option}{isRight ? " (correta)" : ""}</span></div>
                    <span className="fa-bar-value">{n}</span>
                  </div>
                ))}
              </div>
            )}
            {options.length === 0 && keyText(key) && <p className="fa-help" style={{ margin: "8px 0 0" }}>Resposta esperada: {keyText(key)}</p>}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
function SubmissionDetail({ form, blocks, keys, submission, answers, busy, message, messageType, onBack, onNext, onReload, onRelease, onHide, notify }) {
  const [drafts, setDrafts] = useState({});
  const [general, setGeneral] = useState(submission.instructor_feedback || "");
  const [saving, setSaving] = useState("");
  const state = submissionState(submission, form);
  const pct = percent(submission.score, submission.max_score);
  let number = 0;

  useEffect(() => {
    setGeneral(submission.instructor_feedback || "");
    setDrafts({});
  }, [submission.id, submission.instructor_feedback]);

  const draftOf = (answer) => drafts[answer.id] ?? { points: answer.points_awarded ?? "", feedback: answer.feedback ?? "" };
  const setDraft = (answer, patch) => setDrafts((current) => ({ ...current, [answer.id]: { ...draftOf(answer), ...patch } }));

  const saveGrade = async (answer, block) => {
    const draft = draftOf(answer);
    const points = Number(String(draft.points).replace(",", "."));
    if (String(draft.points).trim() === "" || Number.isNaN(points)) return notify("error", "Informe a nota (pode ser 0).");
    setSaving(answer.id);
    const { error } = await supabase.rpc("form_grade_answer", { p_answer_id: answer.id, p_points: points, p_feedback: draft.feedback });
    setSaving("");
    if (error) return notify("error", friendlyFormError(error));
    notify("success", `Nota salva${Number(block.points) ? ` (${formatScore(points)} de ${formatScore(block.points)})` : ""}.`);
    onReload();
  };

  const saveGeneral = async () => {
    setSaving("general");
    const { error } = await supabase.from("form_submissions").update({ instructor_feedback: general.trim() || null }).eq("id", submission.id);
    setSaving("");
    if (error) return notify("error", error.message);
    notify("success", "Comentário geral salvo.");
    onReload();
  };

  const openFile = async (path) => {
    try {
      window.open(await signedFileUrl(path), "_blank", "noopener");
    } catch {
      notify("error", "Não foi possível abrir o arquivo.");
    }
  };

  return (
    <section className="admin-section fa">
      <button type="button" className="fa-btn is-ghost is-small fa-back" onClick={onBack}>← Voltar à lista</button>
      <div className="fa-detail-head">
        <div>
          <h3>{submission.respondent_name || "Anônimo"}</h3>
          <p>{submission.respondent_email || "Sem e-mail"} · tentativa {submission.attempt_number} · enviada em {formatDateTime(submission.submitted_at)}</p>
          <p>
            {Number(submission.max_score) > 0 ? <strong>{formatScore(submission.score)} / {formatScore(submission.max_score)} ({pct}%)</strong> : "Sem nota"}{" "}
            <span className={`fa-pill is-${state.tone}`}>{state.label}</span>{" "}
            {submission.passed !== null && submission.passed !== undefined && <span className={`fa-pill ${submission.passed ? "is-published" : "is-bad"}`}>{submission.passed ? "Aprovado" : "Reprovado"}</span>}
          </p>
        </div>
        <div className="fa-top-actions">
          {submission.pending_manual && <button type="button" className="fa-btn is-ghost" onClick={onNext}>Próxima para corrigir</button>}
          {submission.results_released_at ? (
            <button type="button" className="fa-btn is-ghost" disabled={busy} onClick={onHide}>Ocultar do aluno</button>
          ) : (
            <button type="button" className="fa-btn" disabled={busy || submission.pending_manual} onClick={onRelease} title={submission.pending_manual ? "Corrija todas as questões antes de liberar" : undefined}>Liberar ao aluno</button>
          )}
        </div>
      </div>

      {message && <div className={`fa-alert is-${messageType}`} role="status">{message}</div>}

      {blocks.map((block) => {
        if (!isQuestion(block.type)) return null;
        number += 1;
        const answer = answers[block.id];
        const key = keys[block.id];
        const graded = canHavePoints(block.type) && Number(block.points) > 0;
        const needs = Boolean(answer?.needs_review);
        const draft = answer ? draftOf(answer) : null;
        const text = answerText(answer?.answer);
        const chip = !answer ? null : key?.annulled ? { tone: "", text: "Anulada" } : needs ? { tone: "is-review", text: "Precisa de nota" } : answer.is_correct === true ? { tone: "is-published", text: "Correta" } : answer.is_correct === false ? (Number(answer.points_awarded) > 0 ? { tone: "is-review", text: "Parcial" } : { tone: "is-bad", text: "Incorreta" }) : null;

        return (
          <div className={`fa-grade${needs ? " is-pending" : ""}`} key={block.id}>
            <div className="fa-grade-meta">
              <span>Questão {number} · {blockLabel(block.type)}</span>
              {chip && <span className={`fa-pill ${chip.tone}`}>{chip.text}</span>}
              {graded && answer && <span>{formatScore(answer.points_awarded)} / {formatScore(block.points)} pts</span>}
            </div>
            <h4>{block.title}</h4>
            <div className="fa-answer">
              <small>Resposta do aluno</small>
              {block.type === "file" && answer?.answer?.path ? (
                <button type="button" className="fa-link-btn" onClick={() => openFile(answer.answer.path)}>{answer.answer.name || "Abrir arquivo"}</button>
              ) : (
                text || <em>Em branco</em>
              )}
            </div>
            {keyText(key) && !isManualType(block.type) && <div className="fa-answer"><small>Gabarito</small>{keyText(key)}</div>}
            {isManualType(block.type) && key?.feedback && <div className="fa-answer"><small>Resposta esperada</small>{key.feedback}</div>}

            {graded && answer && (
              <div className="fa-grade-form">
                <label className="fa-field">
                  <span>Nota (0 a {formatScore(block.points)})</span>
                  <input className="fa-input" inputMode="decimal" value={draft.points} onChange={(e) => setDraft(answer, { points: e.target.value })} />
                </label>
                <label className="fa-field">
                  <span>Comentário para o aluno (opcional)</span>
                  <input className="fa-input" value={draft.feedback} onChange={(e) => setDraft(answer, { feedback: e.target.value })} />
                </label>
                <button type="button" className="fa-btn is-small" disabled={saving === answer.id} onClick={() => saveGrade(answer, block)}>
                  {saving === answer.id ? "Salvando..." : needs ? "Salvar nota" : "Ajustar nota"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="fa-card">
        <h3>Comentário geral para o aluno</h3>
        <textarea className="fa-input" rows={3} value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Aparece no topo do resultado, junto com a nota." />
        <div className="fa-actions" style={{ marginTop: 10 }}>
          <button type="button" className="fa-btn is-ghost" disabled={saving === "general"} onClick={saveGeneral}>{saving === "general" ? "Salvando..." : "Salvar comentário"}</button>
        </div>
      </div>
    </section>
  );
}
