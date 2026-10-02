import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import LessonComments from "../../components/member/LessonComments";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import MuxLessonPlayer from "../../components/member/MuxLessonPlayer";
import { supabase } from "../../services/supabase";
import { fetchProductLessons } from "../../services/lessons";
import { getR2DownloadUrl } from "../../services/r2";
import { toEmbedUrl } from "../../services/video";
import "../../styles/member-area.css";

// O selo "ao vivo" vale por 6 horas (SQL 32), o mesmo prazo que o painel usa.
function isLiveFresh(lesson) {
  return Boolean(lesson.is_live && lesson.live_started_at && Date.now() - new Date(lesson.live_started_at).getTime() < 6 * 60 * 60 * 1000);
}

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

export default function CourseLessonsPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedLesson = searchParams.get("aula");
  const [product, setProduct] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hold, setHold] = useState(null); // { in_hold, release_at, total_lessons, visible_lessons } (SQL 30)

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("id,title,ebook_file_path,ebook_file_name").eq("id", productId).maybeSingle(),
      fetchProductLessons(productId),
      supabase.rpc("my_access_hold", { p_product_id: productId }),
    ]).then(([productResult, lessonsResult, holdResult]) => {
      if (productResult.data) setProduct(productResult.data);
      if (!holdResult.error && holdResult.data?.[0]?.in_hold) setHold(holdResult.data[0]);
      if (lessonsResult.error) {
        setMessage("Não foi possível carregar as aulas. Se você acabou de ganhar acesso, espere alguns minutos e recarregue a página.");
      } else {
        const data = (lessonsResult.data || []).filter((lesson) => lesson.status === "published");
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

      {product?.ebook_file_path && (
        <FileDownload
          kind="product"
          id={productId}
          title={product.ebook_file_name || "Material do curso"}
          subtitle="O arquivo deste produto está liberado para download."
        />
      )}

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
                {activeLesson.attachment_file_path && (
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
                      <span className="mb-lesson-meta">
                        {isLiveFresh(lesson) && <span className="mb-lesson-live"><i /> AO VIVO</span>}
                        {lesson.duration && <small>{lesson.duration}</small>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {hold && hold.total_lessons > hold.visible_lessons && (
              <div className="mb-lesson-locked">
                <span className="mb-lesson-locked-icon">{icons.lock}</span>
                <span>
                  <strong>+{hold.total_lessons - hold.visible_lessons} aula(s) trancada(s)</strong>
                  <small>Liberam em {new Date(hold.release_at).toLocaleDateString("pt-BR")}</small>
                </span>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
