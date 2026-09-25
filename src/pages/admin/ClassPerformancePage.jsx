import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { formatDateTime, friendlyFormError, typeLabel } from "../../services/forms";
import { fetchLessonsAndLinks, lessonsForProduct } from "../../services/lessons";
import { INACTIVE_DAYS, LEVEL_LABEL, WEAK_BELOW, formatKey, levelOf, lessonsForTopic } from "../../services/performance";
import "../../styles/forms-admin.css";

const LEVEL_TONE = { weak: "is-bad", mid: "is-review", strong: "is-published", few: "is-draft" };
const norm = (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);

function studentState(student) {
  if (!student.attempts) return { key: "none", label: "Nenhuma prova ainda", tone: "is-draft", attention: true };
  const days = daysSince(student.last);
  if (days !== null && days > INACTIVE_DAYS) return { key: "idle", label: `Parado há ${days} dias`, tone: "is-review", attention: true };
  if (student.avg !== null && student.avg < WEAK_BELOW && student.attempts >= 2) return { key: "low", label: "Média baixa", tone: "is-bad", attention: true };
  return { key: "ok", label: "Em dia", tone: "is-published", attention: false };
}

function Bar({ percent, level }) {
  return (
    <div className={`fa-perf-bar is-${level}`} role="img" aria-label={percent === null ? "sem dados" : `${percent}%`}>
      <span style={{ width: `${percent ?? 0}%` }} />
    </div>
  );
}

function Row({ item, sub = false, active, onFocus, lessons = [] }) {
  const level = levelOf(item.percent, item.answered);
  return (
    <div className={`fa-perf-row${sub ? " is-sub" : ""}${active ? " is-active" : ""}`}>
      <div className="fa-perf-name">
        <strong>{sub ? item.subtopic : item.topic}</strong>
        <small>{item.answered} respostas · {item.students_wrong} de {item.students} {item.students === 1 ? "aluno errou" : "alunos erraram"}</small>
        {(level === "weak" || level === "mid") && lessons.length > 0 && <small className="fa-perf-lessons">Aula para reforçar: {lessons.map((lesson) => lesson.title).join(" · ")}</small>}
      </div>
      <Bar percent={item.percent} level={level} />
      <div className="fa-perf-end">
        <span className="fa-perf-pct">{item.percent === null ? "—" : `${item.percent}%`}</span>
        <span className={`fa-pill ${LEVEL_TONE[level]}`}>{LEVEL_LABEL[level]}</span>
        {item.wrong > 0 && <button type="button" className="fa-link-btn" onClick={onFocus}>{active ? "Ver todas" : "Ver questões"}</button>}
      </div>
    </div>
  );
}

// Visão da turma: onde a turma inteira está errando, quais questões derrubam mais gente e quem precisa de atenção.
export default function ClassPerformancePage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [data, setData] = useState(null);
  const [allLessons, setAllLessons] = useState({ lessons: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});
  const [focus, setFocus] = useState(null);
  const [studentFilter, setStudentFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    supabase.from("products").select("id,title").order("title").then(({ data: rows }) => setProducts(rows || []));
    fetchLessonsAndLinks().then((result) => setAllLessons({ lessons: result.lessons || [], links: result.links || [] }));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setFocus(null);
    supabase.rpc("class_performance", { p_product_id: productId || null }).then(({ data: result, error: rpcError }) => {
      if (!alive) return;
      if (rpcError) setError(/does not exist|PGRST202|class_performance/i.test(rpcError.message) ? "Este recurso ainda não foi ativado. Rode supabase/26_desempenho_turma_e_aluno.sql no Supabase." : friendlyFormError(rpcError));
      else setData(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  const lessons = useMemo(() => {
    if (!productId) return allLessons.lessons;
    return lessonsForProduct(allLessons.lessons, allLessons.links, productId);
  }, [allLessons, productId]);

  const students = useMemo(() => (data?.students || []).map((student) => ({ ...student, state: studentState(student) })), [data]);
  const attentionCount = students.filter((student) => student.state.attention).length;
  const shownStudents = students
    .filter((student) => studentFilter === "all" || (studentFilter === "attention" && student.state.attention) || (studentFilter === "none" && student.state.key === "none"))
    .sort((a, b) => Number(b.state.attention) - Number(a.state.attention) || (a.avg ?? -1) - (b.avg ?? -1));

  const questions = useMemo(() => {
    const list = data?.questions || [];
    if (!focus) return list;
    return list.filter((item) => norm(item.topic) === focus.topic && (!focus.sub || norm(item.subtopic || "Sem subtema") === focus.sub));
  }, [data, focus]);

  if (error) {
    return (
      <section className="admin-section fa">
        <div className="fa-alert is-error" role="alert">{error}</div>
      </section>
    );
  }

  const overview = data?.overview;
  const shownQuestions = showAll ? questions : questions.slice(0, 8);

  return (
    <section className="admin-section fa">
      <div className="fa-top">
        <div>
          <h2>Desempenho da turma</h2>
          <p className="fa-sub">Onde a turma acerta e erra nas provas, simulados e tarefas.</p>
        </div>
        <div className="fa-top-actions">
          <label className="fa-field" style={{ minWidth: 260 }}>
            <span>Turma</span>
            <select className="fa-input" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Todos os alunos</option>
              {products.map((product) => <option key={product.id} value={product.id}>Alunos de: {product.title}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loading || !data ? (
        <div className="admin-empty">Carregando...</div>
      ) : (
        <>
          <div className="fa-stats">
            <div className="fa-stat"><strong>{overview.students_answered} de {overview.students_total}</strong><span>alunos já responderam algo</span></div>
            <div className="fa-stat"><strong>{overview.avg === null ? "—" : `${overview.avg}%`}</strong><span>média da turma</span></div>
            <div className="fa-stat"><strong>{overview.pass_rate === null ? "—" : `${overview.pass_rate}%`}</strong><span>de aprovação (nas provas com nota mínima)</span></div>
            <div className="fa-stat"><strong>{attentionCount}</strong><span>{attentionCount === 1 ? "aluno precisa" : "alunos precisam"} de atenção</span></div>
          </div>

          <div className="fa-card">
            <h3>Onde a turma está errando</h3>
            {data.topics.length === 0 ? (
              <p className="fa-note">Ainda não dá para separar por assunto. Preencha <strong>Tema</strong> e <strong>Subtema</strong> nas perguntas das provas (ou use TEMA e SUBTEMA ao importar).</p>
            ) : (
              <>
                <p className="fa-help" style={{ marginTop: 0 }}>Os assuntos mais fracos vêm primeiro. "Ver questões" mostra as perguntas que mais derrubam a turma naquele assunto.</p>
                <div className="fa-perf">
                  {data.topics.map((topic) => {
                    const key = norm(topic.topic);
                    const level = levelOf(topic.percent, topic.answered);
                    const expanded = open[key] ?? (level === "weak" || level === "mid");
                    const subs = topic.subtopics.filter((sub) => norm(sub.subtopic) !== "sem subtema");
                    return (
                      <div className="fa-perf-topic" key={key}>
                        <div className="fa-perf-head">
                          {subs.length ? (
                            <button type="button" className="fa-perf-toggle" aria-expanded={expanded} aria-label={`${expanded ? "Recolher" : "Abrir"} subtemas de ${topic.topic}`} onClick={() => setOpen((current) => ({ ...current, [key]: !expanded }))}>{expanded ? "−" : "+"}</button>
                          ) : <span className="fa-perf-toggle is-empty" />}
                          <Row item={topic} lessons={lessonsForTopic(lessons, topic.topic)} active={focus?.topic === key && !focus.sub} onFocus={() => setFocus(focus?.topic === key && !focus.sub ? null : { topic: key, sub: null })} />
                        </div>
                        {subs.length > 0 && expanded && (
                          <div className="fa-perf-subs">
                            {subs.map((sub) => {
                              const subKey = norm(sub.subtopic);
                              return <Row key={subKey} item={sub} sub lessons={lessonsForTopic(lessons, topic.topic, sub.subtopic)} active={focus?.topic === key && focus.sub === subKey} onFocus={() => setFocus(focus?.topic === key && focus.sub === subKey ? null : { topic: key, sub: subKey })} />;
                            })}
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
              <h3>Questões que mais derrubam a turma{focus ? " (filtrado)" : ""}</h3>
              {focus && <button type="button" className="fa-btn is-ghost is-small" onClick={() => setFocus(null)}>Limpar filtro</button>}
            </div>
            {questions.length === 0 ? (
              <p className="fa-note">{focus ? "Nenhuma questão neste filtro." : "Ainda não há questões com 3 ou mais respostas e algum erro. Elas aparecem aqui conforme a turma responde."}</p>
            ) : (
              <>
                <div className="fa-missed">
                  {shownQuestions.map((item) => {
                    const rate = Math.round((item.wrong / item.answered) * 100);
                    return (
                      <article className="fa-missed-item" key={item.block_id}>
                        <div className="fa-grade-meta">
                          <span>{item.topic}{item.subtopic ? ` › ${item.subtopic}` : ""}</span>
                          <span className={`fa-pill ${rate >= 70 ? "is-bad" : "is-review"}`}>{rate}% erraram · {item.students_wrong} de {item.students} alunos</span>
                          <span>{item.form_title}</span>
                        </div>
                        <h4>{item.title}</h4>
                        {rate >= 70 && <p className="fa-help" style={{ margin: "0 0 8px" }}>Quase todo mundo erra esta questão: vale rever a aula ou conferir se o enunciado e o gabarito estão certos.</p>}
                        {item.top_wrong && <div className="fa-answer"><small>Resposta errada mais marcada ({item.top_wrong_count}x)</small>{String(item.top_wrong).replace(/^"|"$/g, "")}</div>}
                        {formatKey(item.correct) && <div className="fa-answer"><small>Gabarito</small>{formatKey(item.correct)}</div>}
                        {item.feedback && <div className="fa-answer"><small>Explicação da questão</small>{item.feedback}</div>}
                      </article>
                    );
                  })}
                </div>
                {questions.length > 8 && (
                  <div className="fa-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="fa-btn is-ghost is-small" onClick={() => setShowAll((value) => !value)}>{showAll ? "Mostrar menos" : `Mostrar todas (${questions.length})`}</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="fa-card">
            <div className="fa-card-head">
              <h3>Alunos</h3>
              <div className="fa-seg" role="group" aria-label="Filtrar alunos">
                {[["all", "Todos"], ["attention", `Precisam de atenção (${attentionCount})`], ["none", "Sem nenhuma prova"]].map(([value, label]) => (
                  <button key={value} type="button" className={studentFilter === value ? "is-active" : ""} aria-pressed={studentFilter === value} onClick={() => setStudentFilter(value)}>{label}</button>
                ))}
              </div>
            </div>
            {shownStudents.length === 0 ? (
              <p className="fa-note">Nenhum aluno neste filtro.</p>
            ) : (
              <div className="fa-table-wrap">
                <table className="fa-table">
                  <thead>
                    <tr><th>Aluno</th><th>Envios</th><th>Média</th><th>Última atividade</th><th>Situação</th><th className="is-end"><span className="ra-th">Ficha</span></th></tr>
                  </thead>
                  <tbody>
                    {shownStudents.map((student) => (
                      <tr key={student.id}>
                        <td><strong>{student.name || student.email}</strong><small>{student.email}</small></td>
                        <td className="is-num">{student.attempts}{student.pending ? <small>{student.pending} para corrigir</small> : null}</td>
                        <td>
                          {student.avg === null ? "—" : (
                            <div className="fa-mini-avg"><Bar percent={student.avg} level={levelOf(student.avg, 99)} /><span>{student.avg}%</span></div>
                          )}
                        </td>
                        <td className="is-num">{student.last ? formatDateTime(student.last) : "—"}</td>
                        <td><span className={`fa-pill ${student.state.tone}`}>{student.state.label}</span></td>
                        <td className="is-end"><Link className="fa-link-btn" to={`/admin/usuarios/${student.id}`}>Abrir ficha</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data.forms.length > 0 && (
            <div className="fa-card">
              <h3>Comparação entre provas</h3>
              <p className="fa-help" style={{ marginTop: 0 }}>Da mais antiga para a mais recente. Se a barra sobe, a turma está evoluindo.</p>
              <div className="fa-perf">
                {data.forms.map((form) => (
                  <div className="fa-perf-row is-plain" key={form.id}>
                    <div className="fa-perf-name">
                      <strong>{form.title}</strong>
                      <small>{typeLabel(form.type)} · {form.students} {form.students === 1 ? "aluno" : "alunos"} · {form.attempts} {form.attempts === 1 ? "envio" : "envios"}{form.judged ? ` · ${form.passed} de ${form.judged} aprovados` : ""}</small>
                    </div>
                    <Bar percent={form.avg} level={levelOf(form.avg, 99)} />
                    <div className="fa-perf-end"><span className="fa-perf-pct">{form.avg === null ? "—" : `${form.avg}%`}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
