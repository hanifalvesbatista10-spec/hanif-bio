import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import LessonComments from "../../components/member/LessonComments";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import MuxLessonPlayer from "../../components/member/MuxLessonPlayer";
import { supabase } from "../../services/supabase";
import { toEmbedUrl } from "../../services/video";
import "../../styles/member-area.css";

export default function CourseLessonsPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedLesson = searchParams.get("aula");
  const [product, setProduct] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("id,title").eq("id", productId).maybeSingle(),
      supabase
        .from("product_lessons")
        .select("*")
        .eq("product_id", productId)
        .eq("status", "published")
        .order("position", { ascending: true }),
    ]).then(([productResult, lessonsResult]) => {
      if (productResult.data) setProduct(productResult.data);
      if (lessonsResult.error) {
        setMessage("Não foi possível carregar as aulas. Se você acabou de ganhar acesso, espere alguns minutos e recarregue a página.");
      } else {
        const data = lessonsResult.data || [];
        setLessons(data);
        if (data.length > 0) {
          const wanted = data.find((lesson) => lesson.id === requestedLesson);
          setActiveLessonId((wanted || data[0]).id);
        }
      }
      setLoading(false);
    });
  }, [productId, requestedLesson]);

  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeLessonId);
  const activeLesson = lessons[activeIndex];
  const previous = lessons[activeIndex - 1];
  const following = lessons[activeIndex + 1];

  const pick = (lesson) => {
    setActiveLessonId(lesson.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mb-page is-wide">
      <div className="mb-crumb">
        <Link to="/minha-area">{icons.arrowLeft} Meus cursos</Link>
      </div>
      <div className="mb-page-head is-tight">
        <h1>{product?.title || "Curso"}</h1>
      </div>

      {loading ? (
        <div className="mb-lessons" aria-hidden="true">
          <div className="mb-player-col"><div className="mb-video is-skeleton" /></div>
          <div className="mb-playlist is-skeleton" />
        </div>
      ) : message ? (
        <div className="mb-alert is-error" role="alert">{message}</div>
      ) : lessons.length === 0 ? (
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.play}</span>
          <h2>As aulas ainda não foram publicadas</h2>
          <p>Assim que a equipe publicar a primeira aula deste curso, ela aparece aqui.</p>
        </div>
      ) : (
        <div className="mb-lessons">
          <div className="mb-player-col">
            {activeLesson && (
              <>
                {activeLesson.video_provider === "mux" ? (
                  <MuxLessonPlayer lesson={activeLesson} />
                ) : (
                  <div className="member-video">
                    <iframe
                      src={toEmbedUrl(activeLesson.video_url)}
                      title={activeLesson.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                <div className="mb-lesson-head">
                  <div>
                    <small>Aula {activeIndex + 1} de {lessons.length}</small>
                    <h2>{activeLesson.title}</h2>
                  </div>
                  <div className="mb-lesson-nav">
                    <button type="button" className="mb-btn is-ghost is-small" onClick={() => pick(previous)} disabled={!previous}>
                      {icons.arrowLeft} Anterior
                    </button>
                    <button type="button" className="mb-btn is-small" onClick={() => pick(following)} disabled={!following}>
                      Próxima {icons.arrowRight}
                    </button>
                  </div>
                </div>

                {activeLesson.description && <p className="member-description">{activeLesson.description}</p>}
                <LessonComments lessonId={activeLesson.id} />
              </>
            )}
          </div>

          <aside className="mb-playlist" aria-label="Aulas do curso">
            <h3>Aulas <span>{lessons.length}</span></h3>
            <ol>
              {lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    className={`mb-lesson${lesson.id === activeLessonId ? " is-active" : ""}`}
                    aria-current={lesson.id === activeLessonId ? "true" : undefined}
                    onClick={() => pick(lesson)}
                  >
                    <span className="mb-lesson-num">{lesson.id === activeLessonId ? icons.play : index + 1}</span>
                    <span className="mb-lesson-text">
                      <strong>{lesson.title}</strong>
                      {lesson.duration && <small>{lesson.duration}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
