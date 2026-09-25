import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { formatDateTime, formatScore, typeLabel } from "../../services/forms";
import { INACTIVE_DAYS, LEVEL_LABEL, WEAK_BELOW, computeStudentPerformance, riskSignals, summaryText } from "../../services/performance";
import "../../styles/forms-admin.css";

const LEVEL_TONE = { weak: "is-bad", mid: "is-review", strong: "is-published", few: "is-draft" };

async function inChunks(table, select, column, ids, size = 60) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await supabase.from(table).select(select).in(column, ids.slice(i, i + size));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

function Bar({ percent, level }) {
  return (
    <div className={`fa-perf-bar is-${level}`} role="img" aria-label={percent === null ? "sem dados" : `${percent}%`}>
      <span style={{ width: `${percent ?? 0}%` }} />
    </div>
  );
}

function TopicRow({ item, sub = false, active, onFocus }) {
  return (
    <div className={`fa-perf-row${sub ? " is-sub" : ""}${active ? " is-active" : ""}`}>
      <div className="fa-perf-name">
        <strong>{item.label}</strong>
        <small>{item.answered} {item.answered === 1 ? "resposta" : "respostas"} · errou {item.wrong}</small>
      </div>
      <Bar percent={item.percent} level={item.level} />
      <div className="fa-perf-end">
        <span className="fa-perf-pct">{item.percent === null ? "—" : `${item.percent}%`}</span>
        <span className={`fa-pill ${LEVEL_TONE[item.level]}`}>{LEVEL_LABEL[item.level]}</span>
        {item.wrong > 0 && (
          <button type="button" className="fa-link-btn" onClick={onFocus}>{active ? "Ver todas" : "Ver questões"}</button>
        )}
      </div>
    </div>
  );
}

// Ficha de desempenho do aluno (aberta a partir de Usuários): onde ele acerta, onde ele erra e o que fazer.
export default function StudentPerformancePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [raw, setRaw] = useState({ submissions: [], answers: [], blocks: [], keys: [] });
  const [pendingForms, setPendingForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState({});
  const [focus, setFocus] = useState(null);
  const [showAllMissed, setShowAllMissed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [{ data: person, error: personError }, { data: subs, error: subsError }] = await Promise.all([
          supabase.from("profiles").select("id,full_name,email,phone,role,account_status,last_access").eq("id", id).single(),
          supabase
            .from("form_submissions")
            .select("id,form_id,attempt_number,submitted_at,score,max_score,passed,pending_manual,status,form:forms(title,type,slug)")
            .eq("user_id", id)
            .neq("status", "in_progress")
            .order("submitted_at", { ascending: true }),
        ]);
        if (personError) throw personError;
        if (subsError) throw subsError;

        const submissions = subs || [];
        const formIds = [...new Set(submissions.map((item) => item.form_id))];
        let blocks = [];
        let answers = [];
        if (formIds.length) {
          const { data: blockRows, error: blockError } = await supabase.from("form_blocks").select("*,key:form_block_keys(*)").in("form_id", formIds);
          if (blockError) throw blockError;
          blocks = blockRows || [];
          answers = await inChunks("form_answers", "submission_id,block_id,answer,is_correct,points_awarded,needs_review", "submission_id", submissions.map((item) => item.id));
        }
        const keys = blocks.map((block) => block.key).filter(Boolean);

        // provas abertas para o aluno que ele ainda não fez
        const [{ data: forms }, { data: access }] = await Promise.all([
          supabase.from("forms").select("id,title,type,slug,product_id,ends_at").eq("status", "published").eq("audience", "students"),
          supabase.from("user_products").select("product_id,access_status").eq("user_id", id),
        ]);
        const owned = new Set((access || []).filter((row) => row.access_status === "active").map((row) => row.product_id));
        const done = new Set(formIds);
        const open = (forms || []).filter((form) => !done.has(form.id) && (!form.product_id || owned.has(form.product_id)) && (!form.ends_at || new Date(form.ends_at) > new Date()));

        if (!alive) return;
        setProfile(person);
        setRaw({ submissions, answers, blocks, keys });
        setPendingForms(open);
        setLoading(false);
      } catch (loadError) {
        if (!alive) return;
        setError(loadError.message || "Não foi possível carregar o desempenho.");
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const perf = useMemo(() => computeStudentPerformance(raw), [raw]);
  const signals = useMemo(() => riskSignals(perf, { hasPendingForms: pendingForms.length > 0 }), [perf, pendingForms]);
  const weakCount = perf.topics.filter((topic) => topic.level === "weak").length;

  const missed = useMemo(() => {
    if (!focus) return perf.missed;
    return perf.missed.filter((item) => norm(item.topic) === focus.topic && (!focus.sub || norm(item.subtopic || "Sem subtema") === focus.sub));
  }, [perf, focus]);

  const copy = async (text, ok) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(ok);
    } catch {
      window.prompt("Copie:", text);
    }
  };

  const phoneDigits = String(profile?.phone || "").replace(/\D/g, "");
  const whatsappUrl = phoneDigits ? `https://wa.me/${phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits}` : "";

  if (loading) return <section className="admin-section">Carregando desempenho...</section>;
  if (error) {
    return (
      <section className="admin-section fa">
        <div className="fa-alert is-error" role="alert">{error}</div>
        <Link className="fa-btn is-ghost" to="/admin/usuarios">Voltar aos usuários</Link>
      </section>
    );
  }

  const shownMissed = showAllMissed ? missed : missed.slice(0, 8);
  const trend = perf.overall.trend;

  return (
    <section className="admin-section fa">
      <div className="fa-top">
        <div>
          <h2>{profile.full_name || profile.email}</h2>
          <p className="fa-sub">
            {profile.email}{profile.phone ? ` · ${profile.phone}` : ""}
            {profile.last_access ? ` · último acesso ${formatDateTime(profile.last_access)}` : ""}
          </p>
        </div>
        <div className="fa-top-actions">
          <Link className="fa-btn is-ghost" to="/admin/usuarios">Voltar aos usuários</Link>
          {perf.topics.length > 0 && (
            <button type="button" className="fa-btn is-ghost" onClick={() => copy(summaryText(profile.full_name, perf), "Resumo copiado. Cole numa conversa com o aluno.")}>Copiar resumo</button>
          )}
          {whatsappUrl && <a className="fa-btn" href={whatsappUrl} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>}
        </div>
      </div>

      {message && <div className="fa-alert is-success" role="status">{message}</div>}
      {signals.length > 0 && (
        <div className="fa-alert is-error" role="status">
          <strong>Precisa de atenção:</strong> {signals.join(" · ")}.
        </div>
      )}

      {perf.overall.attempts === 0 ? (
        <div className="admin-empty">
          {profile.full_name || "Este aluno"} ainda não enviou nenhuma prova, simulado ou tarefa.
          {pendingForms.length > 0 && ` Há ${pendingForms.length} ${pendingForms.length === 1 ? "atividade aberta" : "atividades abertas"} para ele.`}
        </div>
      ) : (
        <>
          <div className="fa-stats">
            <div className="fa-stat">
              <strong>{perf.overall.avg === null ? "—" : `${perf.overall.avg}%`}</strong>
              <span>média geral{trend !== null ? (trend > 0 ? ` · subindo ${trend} pts` : trend < 0 ? ` · caindo ${Math.abs(trend)} pts` : " · estável") : ""}</span>
            </div>
            <div className="fa-stat">
              <strong>{perf.overall.attempts}</strong>
              <span>envios · {perf.overall.passed} aprovado{perf.overall.passed === 1 ? "" : "s"}{perf.overall.pending ? ` · ${perf.overall.pending} para corrigir` : ""}</span>
            </div>
            <div className="fa-stat">
              <strong>{perf.overall.daysSince === null ? "—" : perf.overall.daysSince === 0 ? "hoje" : `${perf.overall.daysSince} d`}</strong>
              <span>desde a última atividade{perf.overall.daysSince > INACTIVE_DAYS ? " (parado)" : ""}</span>
            </div>
            <div className="fa-stat">
              <strong>{weakCount}</strong>
              <span>{weakCount === 1 ? "tema" : "temas"} abaixo de {WEAK_BELOW}%</span>
            </div>
          </div>

          <div className="fa-card">
            <h3>Onde está acertando e errando</h3>
            {perf.topics.length === 0 ? (
              <p className="fa-note">Ainda não dá para separar por tema. Preencha o <strong>Tema</strong> e o <strong>Subtema</strong> das perguntas nas provas (ou use TEMA e SUBTEMA ao importar) para ver aqui em quais partes ele erra.</p>
            ) : (
              <>
                <p className="fa-help" style={{ marginTop: 0 }}>
                  Os temas mais fracos vêm primeiro. Clique num tema para ver os subtemas e em "Ver questões" para ler o que ele errou. Com menos de 3 respostas no assunto o site avisa "poucos dados".
                </p>
                <div className="fa-perf">
                  {perf.topics.map((topic) => {
                    const expanded = open[topic.key] ?? (topic.level === "weak" || topic.level === "mid");
                    const hasSubs = topic.subtopics.length > 1 || (topic.subtopics[0] && topic.subtopics[0].key !== "sem subtema");
                    return (
                      <div className="fa-perf-topic" key={topic.key}>
                        <div className="fa-perf-head">
                          {hasSubs ? (
                            <button type="button" className="fa-perf-toggle" aria-expanded={expanded} aria-label={`${expanded ? "Recolher" : "Abrir"} subtemas de ${topic.label}`} onClick={() => setOpen((current) => ({ ...current, [topic.key]: !expanded }))}>{expanded ? "−" : "+"}</button>
                          ) : <span className="fa-perf-toggle is-empty" />}
                          <TopicRow item={topic} active={focus?.topic === topic.key && !focus.sub} onFocus={() => setFocus(focus?.topic === topic.key && !focus.sub ? null : { topic: topic.key, sub: null })} />
                        </div>
                        {hasSubs && expanded && (
                          <div className="fa-perf-subs">
                            {topic.subtopics.map((sub) => (
                              <TopicRow key={sub.key} item={sub} sub active={focus?.topic === topic.key && focus.sub === sub.key} onFocus={() => setFocus(focus?.topic === topic.key && focus.sub === sub.key ? null : { topic: topic.key, sub: sub.key })} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="fa-card">
            <div className="fa-card-head">
              <h3>Questões que ele errou{focus ? " (filtrado)" : ""}</h3>
              {focus && <button type="button" className="fa-btn is-ghost is-small" onClick={() => setFocus(null)}>Limpar filtro</button>}
            </div>
            {missed.length === 0 ? (
              <p className="fa-note">Nenhuma questão errada {focus ? "neste filtro" : "até agora"}.</p>
            ) : (
              <>
                <div className="fa-missed">
                  {shownMissed.map((item) => (
                    <article className="fa-missed-item" key={item.blockId}>
                      <div className="fa-grade-meta">
                        <span>{item.topic}{item.subtopic ? ` › ${item.subtopic}` : ""}</span>
                        <span className="fa-pill is-bad">errou {item.misses} de {item.times} {item.times === 1 ? "vez" : "vezes"}</span>
                        <span>{item.formTitle}</span>
                      </div>
                      <h4>{item.title}</h4>
                      <div className="fa-answer"><small>Respondeu</small>{item.lastAnswer || <em>Em branco</em>}</div>
                      {item.correct && <div className="fa-answer"><small>Gabarito</small>{item.correct}</div>}
                      {item.feedback && <div className="fa-answer"><small>Explicação da questão</small>{item.feedback}</div>}
                    </article>
                  ))}
                </div>
                {missed.length > 8 && (
                  <div className="fa-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="fa-btn is-ghost is-small" onClick={() => setShowAllMissed((value) => !value)}>{showAllMissed ? "Mostrar menos" : `Mostrar todas (${missed.length})`}</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="fa-card">
            <h3>Histórico</h3>
            <div className="fa-table-wrap">
              <table className="fa-table">
                <thead>
                  <tr><th>Data</th><th>Atividade</th><th>Resultado</th><th>Situação</th><th className="is-end"><span className="ra-th">Resposta</span></th></tr>
                </thead>
                <tbody>
                  {[...perf.attempts].reverse().map((item) => (
                    <tr key={item.id}>
                      <td className="is-num">{formatDateTime(item.at)}</td>
                      <td><strong>{item.title}</strong><small>{typeLabel(item.type)} · tentativa {item.attemptNumber}</small></td>
                      <td className="is-num">
                        {item.percent === null ? "—" : `${formatScore(item.score)} / ${formatScore(item.max)} (${item.percent}%)`}
                        {item.pending && <small>parcial</small>}
                      </td>
                      <td>
                        {item.pending ? <span className="fa-pill is-review">Aguardando correção</span> : item.passed === true ? <span className="fa-pill is-published">Aprovado</span> : item.passed === false ? <span className="fa-pill is-bad">Reprovado</span> : <span className="fa-pill is-draft">Sem nota mínima</span>}
                      </td>
                      <td className="is-end"><Link className="fa-link-btn" to={`/admin/formularios/${item.formId}/resultados?resposta=${item.id}`}>Abrir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pendingForms.length > 0 && (
        <div className="fa-card">
          <h3>Ainda não fez</h3>
          <ul className="fa-pending">
            {pendingForms.map((form) => <li key={form.id}><strong>{form.title}</strong><span>{typeLabel(form.type)}{form.ends_at ? ` · até ${formatDateTime(form.ends_at)}` : ""}</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function norm(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
