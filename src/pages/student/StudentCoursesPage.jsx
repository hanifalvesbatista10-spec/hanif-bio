import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import useInstallApp from "../../components/member/useInstallApp";
import { WhatsappGlyph } from "../../components/member/GroupInvite";
import { fetchMyGroupLinks } from "../../services/groupLinks";
import { supabase } from "../../services/supabase";
import { useLessonCounts, useMyLiveLessons, useMyLiveMeetings } from "../../services/productStats";

function LiveBanner({ lives, meetings }) {
  if (lives.length === 0 && meetings.length === 0) return null;
  return (
    <div className="mb-lives" role="status">
      <h2><i /> Ao vivo agora</h2>
      <ul>
        {meetings.map((meeting) => {
          const inner = (
            <>
              <span className="mb-lives-info">
                <strong>{meeting.title}</strong>
                <small>{meeting.product?.title}</small>
              </span>
              <span className="mb-lives-watch">{meeting.meet_url ? "Entrar no Meet" : "Entrar no encontro"} {icons.arrowRight}</span>
            </>
          );
          return (
            <li key={meeting.id}>
              {meeting.meet_url ? (
                <a href={meeting.meet_url} target="_blank" rel="noopener noreferrer">{inner}</a>
              ) : (
                <Link to={`/minha-area/encontro/${meeting.id}`}>{inner}</Link>
              )}
            </li>
          );
        })}
        {lives.map((live) => (
          <li key={live.lesson_id}>
            <Link to={`/minha-area/curso/${live.product_id}?aula=${live.lesson_id}`}>
              <span className="mb-lives-info">
                <strong>{live.title}</strong>
                <small>{live.product_title}</small>
              </span>
              <span className="mb-lives-watch">Assistir {icons.arrowRight}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseCard({ product, lessonCount, groupUrl }) {
  // produto com e-book e sem aulas publicadas (ex.: os e-books à venda): o aluno vem para baixar o arquivo
  const ebookOnly = Boolean(product.ebook_file_path) && !(lessonCount > 0);
  return (
    <article className="mb-course">
      <div className="mb-course-cover">
        {product.cover_url ? <img src={product.cover_url} alt="" loading="lazy" /> : <img className="is-logo" src="/assets/logo-ha.png" alt="" />}
      </div>
      <div className="mb-course-body">
        <h3>
          <Link className="mb-course-link" to={`/minha-area/curso/${product.id}`}>{product.title}</Link>
        </h3>
        {product.short_description && <p>{product.short_description}</p>}
        <span className="mb-course-cta">
          {ebookOnly ? "Baixar e-book" : "Acessar aulas"} {icons.arrowRight}
        </span>
        {groupUrl && (
          <a className="mb-course-group" href={groupUrl} target="_blank" rel="noopener noreferrer">
            <WhatsappGlyph size={16} /> Grupo do WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}

function Skeleton() {
  return (
    <div className="mb-grid" aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <div className="mb-course is-skeleton" key={key}>
          <div className="mb-course-cover" />
          <div className="mb-course-body"><i /><i className="is-short" /></div>
        </div>
      ))}
    </div>
  );
}

export default function StudentCoursesPage() {
  const { user, profile } = useAuth();
  const lives = useMyLiveLessons();
  const liveMeetings = useMyLiveMeetings();
  const lessonCounts = useLessonCounts();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [groupLinks, setGroupLinks] = useState({}); // productId -> link do grupo de WhatsApp (SQL 60)
  const app = useInstallApp();
  const [hideInstall, setHideInstall] = useState(() => {
    try {
      return window.localStorage.getItem("ha_install_hidden") === "1";
    } catch {
      return false;
    }
  });

  const dismissInstall = () => {
    setHideInstall(true);
    try {
      window.localStorage.setItem("ha_install_hidden", "1");
    } catch {
      /* sem armazenamento: o aviso só volta na próxima visita */
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_products")
      .select("access_status,product:products(id,title,slug,cover_url,short_description,ebook_file_path)")
      .eq("user_id", user.id)
      .eq("access_status", "active")
      .then(({ data, error }) => {
        if (error) setMessage("Não conseguimos carregar os seus cursos agora. Recarregue a página em instantes.");
        else setProducts((data || []).map((row) => row.product).filter(Boolean));
        setLoading(false);
      });
    fetchMyGroupLinks().then(setGroupLinks);
    supabase.from("site_settings").select("whatsapp_url").eq("id", 1).maybeSingle().then(({ data }) => setWhatsapp(data?.whatsapp_url || ""));
  }, [user]);

  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0];
  const missing = profile && "cpf" in profile ? [!profile.cpf && "CPF", !profile.avatar_url && "foto"].filter(Boolean) : [];

  return (
    <div className="mb-page">
      <div className="mb-page-head">
        <h1>{firstName ? `Olá, ${firstName}` : "Olá"}</h1>
        <p>Seus cursos e mentorias liberados.</p>
      </div>

      <LiveBanner lives={lives} meetings={liveMeetings} />

      {missing.length > 0 && (
        <div className="mb-notice" role="status">
          <p>
            Faltam {missing.join(" e ")} no seu cadastro. Sem eles, o seu certificado e a sua carteirinha não saem prontos.
          </p>
          <Link className="mb-btn is-small" to="/minha-area/configuracoes?aba=dados">Completar cadastro</Link>
        </div>
      )}

      {app.available && !hideInstall && (
        <div className="mb-notice is-info mb-install" role="status">
          <p>Instale o app para abrir os cursos com um toque, direto da tela inicial.</p>
          <div className="mb-notice-actions">
            <button type="button" className="mb-btn is-small" onClick={() => app.install()}>Instalar</button>
            <button type="button" className="mb-btn is-ghost is-small" onClick={dismissInstall}>Agora não</button>
          </div>
        </div>
      )}

      {message && <div className="mb-alert is-error" role="alert">{message}</div>}

      {loading ? (
        <Skeleton />
      ) : products.length === 0 && !message ? (
        <div className="mb-empty">
          <span className="mb-empty-icon">{icons.courses}</span>
          <h2>Você ainda não tem cursos liberados</h2>
          <p>
            Se você já comprou, o curso aparece aqui quando o pagamento for confirmado. Confira se o e-mail da compra é o mesmo desta conta
            ({profile?.email || user?.email}). Se ainda assim não aparecer, fale com a equipe.
          </p>
          {whatsapp && <a className="mb-btn" href={whatsapp} target="_blank" rel="noreferrer">Falar com a equipe</a>}
        </div>
      ) : (
        <div className="mb-grid">
          {products.map((product) => <CourseCard key={product.id} product={product} lessonCount={lessonCounts[product.id]} groupUrl={groupLinks[product.id]} />)}
        </div>
      )}
    </div>
  );
}
