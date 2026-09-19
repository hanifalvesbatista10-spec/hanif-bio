import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

function toEmbedUrl(url = "") {
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  if (url.includes("youtube.com/embed/")) return url;
  return url;
}

export default function CourseLessonsPage() {
  const { productId } = useParams();
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
        .select("id,title,description,video_url,duration,position")
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
        if (data.length > 0) setActiveLessonId(data[0].id);
      }
      setLoading(false);
    });
  }, [productId]);

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 24, marginTop: 24, alignItems: "start" }}>
            <section className="portal-list">
              <h2>Aulas</h2>
              {lessons.map((lesson, index) => (
                <article
                  key={lesson.id}
                  onClick={() => setActiveLessonId(lesson.id)}
                  style={{ cursor: "pointer", background: lesson.id === activeLessonId ? "#f4f7fb" : "transparent" }}
                >
                  <div>
                    <strong>{index + 1}. {lesson.title}</strong>
                    <span>{lesson.duration || ""}</span>
                  </div>
                </article>
              ))}
            </section>

            <section className="portal-card">
              {activeLesson && (
                <>
                  <h2>{activeLesson.title}</h2>
                  <div style={{ position: "relative", paddingTop: "56.25%", marginTop: 14, borderRadius: 14, overflow: "hidden", background: "#000" }}>
                    <iframe
                      src={toEmbedUrl(activeLesson.video_url)}
                      title={activeLesson.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                  {activeLesson.description && <p style={{ marginTop: 14 }}>{activeLesson.description}</p>}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
