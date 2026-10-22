import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CoursePlaylist from "../../components/member/CoursePlaylist";
import { PdfLesson, YouTubePlayer } from "../../components/member/LessonPlayers";
import LessonComments from "../../components/member/LessonComments";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import MuxLessonPlayer from "../../components/member/MuxLessonPlayer";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { fetchProductLessons, fetchProductModules, flattenGroups, groupByModule, isLiveFresh } from "../../services/lessons";
import { fetchMyMeetingPresence, markMeetingAttendance, presenceWindow } from "../../services/attendance";
import { fetchCompletedLessons, setLessonCompleted } from "../../services/progress";
import { getR2DownloadUrl } from "../../services/r2";
import { meetingLive, meetingWindow } from "../../services/meeting";
import "../../styles/member-area.css";

// Botão de download que só pede o link (Cloudflare R2, expira em poucos minutos) na hora do clique —
// nunca um link fixo que pudesse vazar. Usado tanto pro arquivo do produto (e-book) quanto pelo
// material de uma aula específica.
function FileDownload({ kind, id, title, subtitle }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await getR2DownloadUrl(kind, id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Não foi possível gerar o link de download agora. Tente novamente em instantes.");
    }
    setBusy(false);
  };

  return (
    <div className="mb-alert" role="status">
      <strong>{title}</strong>
      <p style={{ margin: "6px 0 10px" }}>{subtitle}</p>
      <button type="button" className="mb-btn" onClick={download} disabled={busy}>
        {busy ? "Gerando o link..." : "Baixar material"}
      </button>
      {error && <p style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

// Próximos encontros ao vivo do curso (a sala abre 30 min antes e fica disponível até 1 h depois do fim). Durante o encontro o
// aluno marca a presença (vale para o certificado); o resumo "2 de 3" soma os encontros que já começaram.
function LiveMeetings({ productId }) {
  const [meetings, setMeetings] = useState([]);
  const [presence, setPresence] = useState({ meetings: [], marked: new Set(), available: false });
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("live_meetings")
      .select("id,title,description,starts_at,duration_minutes,ended_at,meet_url")
      .eq("product_id", productId)
      .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .then(({ data, error: loadError }) => {
        // sem a tabela (SQL 44 ainda não rodou) ou sem encontros: o bloco simplesmente não aparece
        if (!loadError) setMeetings((data || []).filter((meeting) => meetingWindow(meeting) !== "ended"));
      });
    fetchMyMeetingPresence(productId).then(setPresence);
  }, [productId]);

  const mark = async (meeting) => {
    setBusyId(meeting.id);
    setError("");
    const result = await markMeetingAttendance(meeting.id);
    if (result.error) setError(result.error);
    else
      setPresence((current) => ({
        ...current,
        marked: new Set(current.marked).add(meeting.id),
        meetings: current.meetings.some((item) => item.id === meeting.id) ? current.meetings : [...current.meetings, meeting],
      }));
    setBusyId("");
  };

  const heldCount = presence.meetings.length;
  if (meetings.length === 0 && !(presence.available && heldCount > 0)) return null;

  return (
    <div className="mb-alert" role="status">
      <strong>Encontros ao vivo</strong>
      {meetings.map((meeting) => {
        const open = meetingWindow(meeting) === "open";
        const canMark = presenceWindow(meeting) === "open";
        const marked = presence.marked.has(meeting.id);
        return (
          <div key={meeting.id} style={{ margin: "10px 0 0" }}>
            <div>
              {meetingLive(meeting) && <span className="mb-lesson-live"><i /> AO VIVO AGORA</span>}{" "}
              {meeting.title} — {new Date(meeting.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </div>
            {meeting.description && <p style={{ margin: "4px 0" }}>{meeting.description}</p>}
            <div className="mb-meeting-actions">
              {open && meeting.meet_url ? (
                <a className="mb-btn" href={meeting.meet_url} target="_blank" rel="noopener noreferrer">Entrar no Meet</a>
              ) : open ? (
                <Link className="mb-btn" to={`/minha-area/encontro/${meeting.id}`}>Entrar no encontro</Link>
              ) : (
                <small>{meeting.meet_url ? "O link do Meet libera 30 minutos antes do horário." : "A sala abre 30 minutos antes do horário."}</small>
              )}
              {marked ? (
                <span className="mb-presence-ok">✓ Presença registrada</span>
              ) : (
                canMark && (
                  <button type="button" className="mb-btn is-ghost" onClick={() => mark(meeting)} disabled={busyId === meeting.id}>
                    {busyId === meeting.id ? "Marcando..." : "Marcar minha presença"}
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}
      {error && <p className="mb-pdf-error" role="alert">{error}</p>}
      {presence.available && heldCount > 0 && (
        <p className="mb-presence-summary">Sua presença nos encontros: <strong>{presence.marked.size} de {heldCount}</strong></p>
      )}
    </div>
  );
}

export default function CourseLessonsPage() {
  const { user } = useAuth();
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedLesson = searchParams.get("aula");
  const [product, setProduct] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hold, setHold] = useState(null); // { in_hold, release_at, total_lessons, visible_lessons } (SQL 30)
  const [modules, setModules] = useState([]); // SQL 55
  const [completed, setCompleted] = useState(() => new Set());
  const [progressAvailable, setProgressAvailable] = useState(false);
  const [progressError, setProgressError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const completedRef = useRef(completed);
  completedRef.current = completed;

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("id,title,ebook_file_path,ebook_file_name").eq("id", productId).maybeSingle(),
      fetchProductLessons(productId),
      supabase.rpc("my_access_hold", { p_product_id: productId }),
      fetchProductModules(productId),
    ]).then(async ([productResult, lessonsResult, holdResult, moduleList]) => {
      if (productResult.data) setProduct(productResult.data);
      if (!holdResult.error && holdResult.data?.[0]?.in_hold) setHold(holdResult.data[0]);
      setModules(moduleList);
      if (lessonsResult.error) {
        setMessage("Não foi possível carregar as aulas. Se você acabou de ganhar acesso, espere alguns minutos e recarregue a página.");
      } else {
        const data = (lessonsResult.data || []).filter((lesson) => lesson.status === "published");
        setLessons(data);
        const progress = await fetchCompletedLessons(data.map((lesson) => lesson.id));
        setCompleted(progress.ids);
        setProgressAvailable(progress.available);
        if (data.length > 0) {
          // abre a aula pedida; senão, a primeira que o aluno ainda não concluiu (onde ele parou)
          const inOrder = flattenGroups(groupByModule(data, moduleList));
          const wanted = inOrder.find((lesson) => lesson.id === requestedLesson);
          setActiveLessonId((wanted || inOrder.find((lesson) => !progress.ids.has(lesson.id)) || inOrder[0]).id);
        }
      }
      setLoading(false);
    });
  }, [productId, requestedLesson]);

  const groups = useMemo(() => groupByModule(lessons, modules), [lessons, modules]);
  const ordered = useMemo(() => flattenGroups(groups), [groups]);
  const activeIndex = ordered.findIndex((lesson) => lesson.id === activeLessonId);
  const activeLesson = ordered[activeIndex];
  const previous = ordered[activeIndex - 1];
  const following = ordered[activeIndex + 1];
  const activeDone = activeLesson ? completed.has(activeLesson.id) : false;

  const pick = (lesson) => {
    setActiveLessonId(lesson.id);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Marca/desmarca já na tela e confirma no banco; se falhar, volta atrás e avisa.
  const setDone = useCallback(
    async (lesson, done, source = "manual") => {
      if (!user?.id || !lesson) return;
      setProgressError("");
      setCompleted((current) => {
        const next = new Set(current);
        if (done) next.add(lesson.id);
        else next.delete(lesson.id);
        return next;
      });
      const error = await setLessonCompleted({ userId: user.id, lessonId: lesson.id, completed: done, source });
      if (error) {
        setCompleted((current) => {
          const next = new Set(current);
          if (done) next.delete(lesson.id);
          else next.add(lesson.id);
          return next;
        });
        setProgressError("Não foi possível salvar a conclusão desta aula. Tente de novo.");
      }
    },
    [user?.id]
  );

  // Em aula ao vivo, marcar vale como presença (origem "live"); fora disso é conclusão normal.
  const toggleDone = (lesson) => setDone(lesson, !completedRef.current.has(lesson.id), isLiveFresh(lesson) ? "live" : "manual");

  // fim do vídeo: marca sozinho (nunca desmarca, e não repete se já estava concluída)
  const activeLessonRef = useRef(null);
  activeLessonRef.current = activeLesson;
  const handleEnded = useCallback(() => {
    const lesson = activeLessonRef.current;
    if (lesson && !completedRef.current.has(lesson.id)) setDone(lesson, true, "auto");
  }, [setDone]);

  return (
    <div className="mb-page is-wide">
      <div className="mb-crumb">
        <Link to="/minha-area">{icons.arrowLeft} Meus cursos</Link>
      </div>
      <div className="mb-page-head is-tight">
        <h1>{product?.title || "Curso"}</h1>
      </div>

      {product?.ebook_file_path && (
        <FileDownload
          kind="product"
          id={productId}
          title={product.ebook_file_name || "Material do curso"}
          subtitle="O arquivo deste produto está liberado para download."
        />
      )}

      <LiveMeetings productId={productId} />

      {hold && (
        <div className="mb-alert" role="status">
          Você está no período de garantia de 7 dias: {hold.visible_lessons} de {hold.total_lessons} aula(s) já liberada(s). As demais liberam
          sozinhas em {new Date(hold.release_at).toLocaleDateString("pt-BR")}.
        </div>
      )}

      {loading ? (
        <div className="mb-lessons" aria-hidden="true">
          <div className="mb-player-col"><div className="mb-video is-skeleton" /></div>
          <div className="mb-playlist is-skeleton" />
        </div>
      ) : message ? (
        <div className="mb-alert is-error" role="alert">{message}</div>
      ) : lessons.length === 0 ? (
        product?.ebook_file_path ? null : (
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.play}</span>
          <h2>As aulas ainda não foram publicadas</h2>
          <p>Assim que a equipe publicar a primeira aula deste curso, ela aparece aqui.</p>
        </div>
        )
      ) : (
        <div className="mb-lessons">
          <div className="mb-player-col">
            {activeLesson && (
              <>
                {activeLesson.content_type === "pdf" ? (
                  <PdfLesson lesson={activeLesson} />
                ) : activeLesson.video_provider === "mux" ? (
                  <MuxLessonPlayer lesson={activeLesson} onEnded={handleEnded} />
                ) : (
                  <YouTubePlayer lesson={activeLesson} onEnded={handleEnded} />
                )}

                <div className="mb-lesson-head">
                  <div>
                    <small>Aula {activeIndex + 1} de {ordered.length}</small>
                    <h2>{activeLesson.title}</h2>
                  </div>
                  <div className="mb-lesson-nav">
                    {progressAvailable && (
                      <button
                        type="button"
                        className={`mb-btn is-small mb-done-btn${activeDone ? " is-done" : " is-ghost"}`}
                        aria-pressed={activeDone}
                        onClick={() => toggleDone(activeLesson)}
                      >
                        {activeDone ? (isLiveFresh(activeLesson) ? "Presença marcada ✓" : "Concluída ✓") : isLiveFresh(activeLesson) ? "Marcar presença" : "Marcar como concluída"}
                      </button>
                    )}
                    <button type="button" className="mb-btn is-ghost is-small" onClick={() => pick(previous)} disabled={!previous}>
                      {icons.arrowLeft} Anterior
                    </button>
                    <button type="button" className="mb-btn is-small" onClick={() => pick(following)} disabled={!following}>
                      Próxima {icons.arrowRight}
                    </button>
                  </div>
                </div>
                {progressError && <div className="mb-alert is-error" role="alert">{progressError}</div>}

                <button type="button" className="mb-btn is-ghost mb-playlist-open" onClick={() => setDrawerOpen(true)}>
                  Aulas do curso{progressAvailable ? ` · ${completed.size} de ${ordered.length} concluídas` : ""}
                </button>

                {activeLesson.description && <p className="member-description">{activeLesson.description}</p>}
                {activeLesson.content_type !== "pdf" && activeLesson.attachment_file_path && (
                  <FileDownload
                    kind="lesson"
                    id={activeLesson.id}
                    title={activeLesson.attachment_file_name || "Material desta aula"}
                    subtitle="Arquivo liberado para download junto com esta aula."
                  />
                )}
                <LessonComments lessonId={activeLesson.id} />
              </>
            )}
          </div>

          <CoursePlaylist
            groups={groups}
            activeId={activeLessonId}
            completed={completed}
            progressAvailable={progressAvailable}
            hold={hold}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onPick={pick}
            onToggle={toggleDone}
          />
        </div>
      )}
    </div>
  );
}
