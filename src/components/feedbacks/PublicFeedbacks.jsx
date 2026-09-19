import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import Accent from "../ui/Accent";
import DepthCarousel from "../ui/DepthCarousel";
import Reveal from "../ui/Reveal";
import SectionHeading from "../ui/SectionHeading";

function Stars({ rating = 5 }) {
  const safeRating = Math.max(1, Math.min(5, Number(rating) || 5));
  return (
    <div className="hx-stars" role="img" aria-label={`${safeRating} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < safeRating ? "is-filled" : ""} aria-hidden="true">★</span>
      ))}
    </div>
  );
}

function initials(name = "Aluno") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function PublicFeedbacks({ limit = 8, compact = false }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFeedbacks() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("student_feedbacks")
        .select(`
          id,
          student_name,
          student_photo,
          profession,
          title,
          testimonial,
          rating,
          testimonial_date,
          institution,
          city,
          result_achieved,
          is_featured,
          is_verified,
          display_order,
          product:products(title)
        `)
        .eq("status", "published")
        .eq("publication_authorized", true)
        .order("is_featured", { ascending: false })
        .order("display_order", { ascending: true })
        .order("testimonial_date", { ascending: false })
        .limit(limit);

      if (!active) return;

      if (error) {
        console.error("Erro ao carregar feedbacks públicos:", error);
        setErrorMessage("Os depoimentos não puderam ser carregados neste momento.");
        setFeedbacks([]);
      } else {
        setFeedbacks(data || []);
      }

      setLoading(false);
    }

    loadFeedbacks();

    const channel = supabase
      .channel("public-feedbacks-home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_feedbacks" },
        loadFeedbacks
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  const subtitle = compact
    ? "Relatos reais de alunos e profissionais que participaram dos projetos."
    : "Experiências reais de alunos e profissionais que confiaram nos conteúdos, produtos e formações.";

  const slides = useMemo(
    () =>
      feedbacks.map((feedback) => {
        const location = [feedback.city, feedback.institution].filter(Boolean).join(" • ");
        const date = feedback.testimonial_date
          ? new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(
              new Date(`${feedback.testimonial_date}T12:00:00`)
            )
          : "";

        return {
          key: feedback.id,
          node: (
            <article className={`hx-feedback ${feedback.is_featured ? "is-featured" : ""}`}>
              <span className="hx-feedback-mark" aria-hidden="true">“</span>
              <Stars rating={feedback.rating} />
              {feedback.title && <h3>{feedback.title}</h3>}
              <blockquote className="hx-feedback-quote">{feedback.testimonial}</blockquote>

              {feedback.result_achieved && (
                <div className="hx-feedback-result">
                  <strong>Resultado:</strong> {feedback.result_achieved}
                </div>
              )}

              <footer className="hx-feedback-person">
                <div className="hx-feedback-avatar">
                  {feedback.student_photo ? (
                    <img src={feedback.student_photo} alt={`Foto de ${feedback.student_name}`} loading="lazy" />
                  ) : (
                    initials(feedback.student_name)
                  )}
                </div>
                <div>
                  <strong>
                    {feedback.student_name}
                    {feedback.is_verified && <span className="verified-seal" title="Aluno verificado">✓</span>}
                  </strong>
                  <span>
                    {feedback.profession || "Aluno"}
                    {feedback.product?.title ? ` • ${feedback.product.title}` : ""}
                  </span>
                  {(location || date) && <small>{[location, date].filter(Boolean).join(" · ")}</small>}
                </div>
              </footer>
            </article>
          ),
        };
      }),
    [feedbacks]
  );

  if (!loading && feedbacks.length === 0 && !errorMessage) return null;

  return (
    <section className={`hx-section hx-feedbacks ${compact ? "compact" : ""}`} id="feedbacks" aria-labelledby="feedbacks-title">
      <div className="site-container">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Resultados e experiências"
            title={<Accent text="O que os alunos *dizem*" />}
            id="feedbacks-title"
            lead={subtitle}
          />
        </Reveal>

        {loading ? (
          <div className="hx-feedback-skeleton" aria-label="Carregando depoimentos" />
        ) : errorMessage ? (
          <div className="hx-feedback-state">{errorMessage}</div>
        ) : (
          <Reveal delay={80}>
            <DepthCarousel slides={slides} label="Depoimentos de alunos" />
          </Reveal>
        )}
      </div>
    </section>
  );
}
