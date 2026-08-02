import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

function Stars({ rating = 5 }) {
  const safeRating = Math.max(1, Math.min(5, Number(rating) || 5));
  return (
    <div className="public-feedback-stars" aria-label={`${safeRating} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < safeRating ? "filled" : ""}>★</span>
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

  const subtitle = useMemo(
    () =>
      compact
        ? "Relatos reais de alunos e profissionais que participaram dos projetos."
        : "Experiências reais de alunos e profissionais que confiaram nos conteúdos, produtos e formações.",
    [compact]
  );

  if (!loading && feedbacks.length === 0 && !errorMessage) return null;

  return (
    <section className={`public-feedback-section ${compact ? "compact" : ""}`} id="feedbacks">
      <style>{`
        .public-feedback-section{padding:92px 0;background:radial-gradient(circle at 85% 10%,rgba(220,22,47,.08),transparent 30%),#f5f7fa;color:#0b1b2d}
        .public-feedback-heading{max-width:800px;margin:0 auto 42px;text-align:center}
        .public-feedback-tag{color:#d6162e;font-size:.74rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
        .public-feedback-heading h2{margin:10px 0 14px;color:#071426;font-size:clamp(2rem,4.5vw,3.7rem);line-height:1.06;letter-spacing:-.04em}
        .public-feedback-heading p{max-width:680px;margin:0 auto;color:#64768a;font-size:1rem;line-height:1.75}
        .public-feedback-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
        .public-feedback-card{position:relative;display:flex;flex-direction:column;min-height:100%;padding:26px;border:1px solid rgba(8,31,54,.09);border-radius:22px;background:#fff;box-shadow:0 18px 48px rgba(8,31,54,.08)}
        .public-feedback-card.featured{border-color:rgba(214,22,46,.24);box-shadow:0 22px 58px rgba(214,22,46,.10)}
        .public-feedback-top{display:flex;align-items:center;gap:13px;margin-bottom:17px}
        .public-feedback-avatar{width:54px;height:54px;flex:0 0 54px;overflow:hidden;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#071426,#173a5f);color:#fff;font-size:.88rem;font-weight:900;letter-spacing:.05em}
        .public-feedback-avatar img{width:100%;height:100%;object-fit:cover}
        .public-feedback-person{min-width:0;flex:1}
        .public-feedback-person strong{display:flex;align-items:center;gap:6px;color:#071426;font-size:1rem;line-height:1.25}
        .verified-seal{width:18px;height:18px;display:inline-grid;place-items:center;border-radius:50%;background:#d6162e;color:#fff;font-size:.65rem}
        .public-feedback-person span{display:block;margin-top:4px;color:#778799;font-size:.78rem;line-height:1.35}
        .public-feedback-stars{display:flex;gap:2px;margin-bottom:14px}
        .public-feedback-stars span{color:#d8dde3;font-size:1.05rem}
        .public-feedback-stars span.filled{color:#f5a623}
        .public-feedback-card h3{margin:0 0 9px;color:#0b1b2d;font-size:1.08rem;line-height:1.35}
        .public-feedback-quote{flex:1;margin:0;color:#4d6074;font-size:.94rem;line-height:1.72}
        .public-feedback-result{margin-top:17px;padding:12px 14px;border-left:4px solid #d6162e;border-radius:0 11px 11px 0;background:#f7f9fb;color:#23384e;font-size:.83rem;line-height:1.5}
        .public-feedback-footer{display:flex;justify-content:space-between;gap:12px;margin-top:18px;padding-top:15px;border-top:1px solid rgba(8,31,54,.08);color:#8391a0;font-size:.72rem}
        .public-feedback-featured-label{position:absolute;top:16px;right:16px;padding:6px 9px;border-radius:999px;background:rgba(214,22,46,.09);color:#c3142a;font-size:.61rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
        .public-feedback-state{max-width:760px;margin:0 auto;padding:26px;border-radius:18px;text-align:center;background:#fff;border:1px solid rgba(8,31,54,.08);color:#64768a}
        .public-feedback-skeleton-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
        .public-feedback-skeleton{height:290px;border-radius:22px;background:linear-gradient(90deg,#e9edf2 25%,#f7f9fb 50%,#e9edf2 75%);background-size:200% 100%;animation:feedbackPulse 1.35s infinite}
        @keyframes feedbackPulse{to{background-position:-200% 0}}
        @media(max-width:950px){.public-feedback-grid,.public-feedback-skeleton-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:620px){.public-feedback-section{padding:66px 0}.public-feedback-grid,.public-feedback-skeleton-grid{grid-template-columns:1fr}.public-feedback-card{padding:22px}.public-feedback-heading{margin-bottom:30px}}
      `}</style>

      <div className="container">
        <div className="public-feedback-heading">
          <div className="public-feedback-tag">RESULTADOS E EXPERIÊNCIAS</div>
          <h2>O que os alunos dizem</h2>
          <p>{subtitle}</p>
        </div>

        {loading ? (
          <div className="public-feedback-skeleton-grid" aria-label="Carregando depoimentos">
            <div className="public-feedback-skeleton" />
            <div className="public-feedback-skeleton" />
            <div className="public-feedback-skeleton" />
          </div>
        ) : errorMessage ? (
          <div className="public-feedback-state">{errorMessage}</div>
        ) : (
          <div className="public-feedback-grid">
            {feedbacks.map((feedback) => {
              const location = [feedback.city, feedback.institution].filter(Boolean).join(" • ");
              const date = feedback.testimonial_date
                ? new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })
                    .format(new Date(`${feedback.testimonial_date}T12:00:00`))
                : "";

              return (
                <article className={`public-feedback-card ${feedback.is_featured ? "featured" : ""}`} key={feedback.id}>
                  {feedback.is_featured && <span className="public-feedback-featured-label">Destaque</span>}

                  <div className="public-feedback-top">
                    <div className="public-feedback-avatar">
                      {feedback.student_photo ? (
                        <img src={feedback.student_photo} alt={`Foto de ${feedback.student_name}`} loading="lazy" />
                      ) : initials(feedback.student_name)}
                    </div>

                    <div className="public-feedback-person">
                      <strong>
                        {feedback.student_name}
                        {feedback.is_verified && <span className="verified-seal" title="Aluno verificado">✓</span>}
                      </strong>
                      <span>
                        {feedback.profession || "Aluno"}
                        {feedback.product?.title ? ` • ${feedback.product.title}` : ""}
                      </span>
                    </div>
                  </div>

                  <Stars rating={feedback.rating} />
                  {feedback.title && <h3>{feedback.title}</h3>}
                  <blockquote className="public-feedback-quote">“{feedback.testimonial}”</blockquote>

                  {feedback.result_achieved && (
                    <div className="public-feedback-result">
                      <strong>Resultado:</strong> {feedback.result_achieved}
                    </div>
                  )}

                  {(location || date) && (
                    <footer className="public-feedback-footer">
                      <span>{location}</span>
                      <span>{date}</span>
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
