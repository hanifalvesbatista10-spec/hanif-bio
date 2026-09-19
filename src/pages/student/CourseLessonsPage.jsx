import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import LessonComments from "../../components/member/LessonComments";
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
        setMessage(
          "Não foi possível carregar as aulas. Se você acabou de ganhar acesso, aguarde alguns minutos e recarregue a página."
        );
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

  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId);

  return (
    <div className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <div>
            <span>MINHAS AULAS</span>
            <h1>{product?.title || "Curso"}</h1>
          </div>
          <Link className="portal-home" to="/minha-area" style={{ marginTop: 0 }}>← Meus cursos</Link>
        </header>

        {loading ? (
          <p className="empty" style={{ marginTop: 24 }}>Carregando aulas...</p>
        ) : message ? (
          <p className="empty" style={{ marginTop: 24 }}>{message}</p>
        ) : lessons.length === 0 ? (
          <p className="empty" style={{ marginTop: 24 }}>Nenhuma aula publicada ainda. Volte em breve.</p>
        ) : (
          <div className="member-layout">
            <section className="portal-list member-lessons">
              <h2>Aulas</h2>
              {lessons.map((lesson, index) => (
                <article
                  key={lesson.id}
                  className={lesson.id === activeLessonId ? "is-active" : ""}
                  onClick={() => setActiveLessonId(lesson.id)}
                >
                  <div>
                    <strong>{index + 1}. {lesson.title}</strong>
                    <span>{lesson.duration || ""}</span>
                  </div>
                </article>
              ))}
            </section>

            <section className="portal-card member-player">
              {activeLesson && (
                <>
                  <h2>{activeLesson.title}</h2>
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
                  {activeLesson.description && <p className="member-description">{activeLesson.description}</p>}
                  <LessonComments lessonId={activeLesson.id} />
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
