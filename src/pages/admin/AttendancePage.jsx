import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { fetchCourseAttendance, meetsMinimum, setLessonMark, setMeetingMark, studentTotals } from "../../services/attendance";
import { buildCsv } from "../../services/finance";

const dateLabel = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const SOURCE_LABEL = { manual: "marcou", auto: "terminou o vídeo", live: "presença ao vivo", student: "marcou", admin: "marcado pelo painel" };

function downloadCsv(content, name) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Quem esteve presente em cada curso: aulas concluídas (ou presença em aula ao vivo) e presença nos encontros.
// O certificado continua sendo emitido à mão em "Certificados"; aqui você vê quem cumpre o mínimo que definir.
export default function AttendancePage() {
  const [params, setParams] = useSearchParams();
  const productId = params.get("produto") || "";
  const [products, setProducts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [minPercent, setMinPercent] = useState(75);
  const [minMeetings, setMinMeetings] = useState(0);
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [details, setDetails] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    supabase
      .from("products")
      .select("id,title")
      .order("title", { ascending: true })
      .then(({ data: list }) => {
        setProducts(list || []);
        if (!params.get("produto") && list?.length) {
          const next = new URLSearchParams(params);
          next.set("produto", list[0].id);
          setParams(next, { replace: true });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!productId) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    fetchCourseAttendance(productId).then((result) => {
      if (!active) return;
      if (result.error) {
        setError(/does not exist|relation|meeting_attendance|lesson_progress/.test(result.error)
          ? "O banco ainda não tem a presença. Execute supabase/55_modulos_conclusao_e_aula_pdf.sql e supabase/56_presenca_para_certificado.sql no SQL Editor."
          : result.error);
        setData(null);
      } else {
        setData(result);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [productId, reload]);

  const rows = useMemo(() => {
    if (!data) return [];
    const minimum = { minPercent: Number(minPercent) || 0, minMeetings: Number(minMeetings) || 0 };
    return data.students.map((student) => {
      const totals = studentTotals(data, student.id);
      return { student, totals, eligible: meetsMinimum(totals, minimum) };
    });
  }, [data, minPercent, minMeetings]);

  const shown = onlyEligible ? rows.filter((row) => row.eligible) : rows;
  const eligibleCount = rows.filter((row) => row.eligible).length;
  const product = products.find((item) => item.id === productId);

  // Marca/tira à mão (origem "admin") e atualiza a tabela sem recarregar tudo.
  const toggle = useCallback(
    async (kind, student, item) => {
      const key = `${student.id}:${item.id}`;
      const marked = kind === "lesson" ? data.progress.has(key) : data.attendance.has(key);
      setBusyKey(key);
      setMessage("");
      const failure =
        kind === "lesson"
          ? await setLessonMark({ studentId: student.id, lessonId: item.id, marked: !marked })
          : await setMeetingMark({ studentId: student.id, meetingId: item.id, marked: !marked });
      setBusyKey("");
      if (failure) return setError(`Não foi possível alterar a marcação: ${failure.message}`);
      setData((current) => {
        const field = kind === "lesson" ? "progress" : "attendance";
        const next = new Map(current[field]);
        if (marked) next.delete(key);
        else next.set(key, { source: "admin" });
        return { ...current, [field]: next };
      });
    },
    [data]
  );

  const exportCsv = () => {
    const header = ["Aluno", "E-mail", "Aulas concluídas", "Total de aulas", "% das aulas", "Encontros com presença", "Total de encontros", `Cumpre (${minPercent}% e ${minMeetings} encontro(s))`];
    const lessonHeads = data.lessons.map((lesson, index) => `Aula ${index + 1}: ${lesson.title}`);
    const meetingHeads = data.meetings.map((meeting) => `Encontro ${dateLabel(meeting.starts_at)}: ${meeting.title}`);
    const lines = shown.map(({ student, totals, eligible }) => [
      student.full_name || "",
      student.email || "",
      totals.lessonsDone,
      totals.lessonsTotal,
      totals.lessonsPercent,
      totals.meetingsDone,
      totals.meetingsTotal,
      eligible ? "Sim" : "Não",
      ...data.lessons.map((lesson) => (data.progress.has(`${student.id}:${lesson.id}`) ? "Sim" : "")),
      ...data.meetings.map((meeting) => (data.attendance.has(`${student.id}:${meeting.id}`) ? "Sim" : "")),
    ]);
    const slug = (product?.title || "curso").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadCsv(buildCsv([...header, ...lessonHeads, ...meetingHeads], lines), `presenca-${slug}.csv`);
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ENGAJAMENTO</span>
          <h2>Presença e certificados</h2>
        </div>
        <div className="adm-head-actions">
          <button type="button" className="admin-button" onClick={exportCsv} disabled={!data || shown.length === 0}>Exportar CSV</button>
          <Link className="admin-button primary" to="/admin/certificados">Emitir certificados</Link>
        </div>
      </div>

      <p className="adm-hint">
        Mostra quem concluiu as aulas (ou marcou presença na aula ao vivo) e quem marcou presença nos encontros. O certificado continua sendo
        emitido por você: defina o mínimo abaixo para ver quem cumpre e depois selecione essas pessoas na emissão.
      </p>

      <div className="adm-att-controls">
        <label>
          Curso
          <select value={productId} onChange={(event) => setParams({ produto: event.target.value })}>
            {products.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label>
          Mínimo de aulas concluídas (%)
          <input type="number" min="0" max="100" value={minPercent} onChange={(event) => setMinPercent(event.target.value)} />
        </label>
        <label>
          Mínimo de encontros com presença
          <input type="number" min="0" value={minMeetings} onChange={(event) => setMinMeetings(event.target.value)} />
        </label>
      </div>

      {message && <div className="admin-alert" role="status">{message}</div>}
      {error && <div className="admin-alert error" role="alert">{error}</div>}

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : data && data.students.length === 0 ? (
        <div className="admin-empty">Nenhum aluno com acesso ativo a este curso.</div>
      ) : data ? (
        <>
          <div className="adm-facts">
            <span><strong>{data.students.length}</strong> aluno(s)</span>
            <span><strong>{data.lessons.length}</strong> aula(s) publicada(s)</span>
            <span><strong>{data.meetings.length}</strong> encontro(s) já realizado(s)</span>
            <span><strong>{eligibleCount}</strong> cumprem o mínimo</span>
          </div>

          <div className="adm-att-toolbar">
            <label className="adm-check-row">
              <input type="checkbox" checked={onlyEligible} onChange={(event) => setOnlyEligible(event.target.checked)} />
              Mostrar só quem cumpre o mínimo
            </label>
            <label className="adm-check-row">
              <input type="checkbox" checked={details} onChange={(event) => setDetails(event.target.checked)} />
              Mostrar cada aula e encontro (e ajustar à mão)
            </label>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table adm-att-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Aulas</th>
                  <th>Encontros</th>
                  <th>Mínimo</th>
                  {details && data.lessons.map((lesson, index) => <th key={lesson.id} className="adm-att-col" title={lesson.title}>A{index + 1}</th>)}
                  {details && data.meetings.map((meeting) => <th key={meeting.id} className="adm-att-col" title={meeting.title}>E {dateLabel(meeting.starts_at)}</th>)}
                </tr>
              </thead>
              <tbody>
                {shown.map(({ student, totals, eligible }) => (
                  <tr key={student.id}>
                    <td><strong>{student.full_name || student.email}</strong><small>{student.email}</small></td>
                    <td>{totals.lessonsDone}/{totals.lessonsTotal} <small>{totals.lessonsPercent}%</small></td>
                    <td>{totals.meetingsDone}/{totals.meetingsTotal}</td>
                    <td><span className={`status-badge ${eligible ? "published" : "draft"}`}>{eligible ? "Cumpre" : "Não cumpre"}</span></td>
                    {details && data.lessons.map((lesson) => {
                      const key = `${student.id}:${lesson.id}`;
                      const row = data.progress.get(key);
                      return (
                        <td key={lesson.id} className="adm-att-col">
                          <button type="button" className={`adm-att-cell${row ? " is-on" : ""}`} disabled={busyKey === key} onClick={() => toggle("lesson", student, lesson)}
                            title={row ? `${lesson.title}: ${SOURCE_LABEL[row.source] || "marcado"}. Clique para tirar.` : `${lesson.title}: clique para marcar como concluída.`}
                            aria-label={`${lesson.title} — ${student.full_name || student.email}: ${row ? "concluída" : "não concluída"}`}>
                            {row ? "✓" : "·"}
                          </button>
                        </td>
                      );
                    })}
                    {details && data.meetings.map((meeting) => {
                      const key = `${student.id}:${meeting.id}`;
                      const row = data.attendance.get(key);
                      return (
                        <td key={meeting.id} className="adm-att-col">
                          <button type="button" className={`adm-att-cell${row ? " is-on" : ""}`} disabled={busyKey === key} onClick={() => toggle("meeting", student, meeting)}
                            title={row ? `${meeting.title}: ${SOURCE_LABEL[row.source] || "marcado"}${row.marked_at ? ` às ${new Date(row.marked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}. Clique para tirar.` : `${meeting.title}: clique para marcar presença.`}
                            aria-label={`${meeting.title} — ${student.full_name || student.email}: ${row ? "presente" : "ausente"}`}>
                            {row ? "✓" : "·"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {details && (
            <ol className="adm-att-legend" aria-label="Legenda das colunas">
              {data.lessons.map((lesson, index) => <li key={lesson.id}><strong>A{index + 1}</strong> {lesson.title}</li>)}
              {data.meetings.map((meeting) => <li key={meeting.id}><strong>E {dateLabel(meeting.starts_at)}</strong> {meeting.title}</li>)}
            </ol>
          )}
          <p className="adm-hint">
            <button type="button" className="adm-action" onClick={() => setReload((value) => value + 1)}>Atualizar</button>{" "}
            Marcações feitas por aqui aparecem como “marcado pelo painel”. Só entram aulas publicadas e encontros que já começaram.
          </p>
        </>
      ) : null}
    </section>
  );
}
