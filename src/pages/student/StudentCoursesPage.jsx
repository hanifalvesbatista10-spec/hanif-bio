import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import { supabase } from "../../services/supabase";

function CourseCard({ product }) {
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
          Acessar aulas {icons.arrowRight}
        </span>
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
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_products")
      .select("access_status,product:products(id,title,slug,cover_url,short_description)")
      .eq("user_id", user.id)
      .eq("access_status", "active")
      .then(({ data, error }) => {
        if (error) setMessage("Não conseguimos carregar os seus cursos agora. Recarregue a página em instantes.");
        else setProducts((data || []).map((row) => row.product).filter(Boolean));
        setLoading(false);
      });
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

      {missing.length > 0 && (
        <div className="mb-notice" role="status">
          <p>
            Faltam {missing.join(" e ")} no seu cadastro. Sem eles, o seu certificado e a sua carteirinha não saem prontos.
          </p>
          <Link className="mb-btn is-small" to="/minha-area/configuracoes?aba=dados">Completar cadastro</Link>
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
          {products.map((product) => <CourseCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
}
