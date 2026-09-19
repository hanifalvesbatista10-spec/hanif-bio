import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import MyCertificates from "../../components/member/MyCertificates";
import { supabase } from "../../services/supabase";

export default function StudentCoursesPage() {
  const { user, profile, signOut } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_products")
      .select("access_status,product:products(id,title,slug,cover_url,short_description)")
      .eq("user_id", user.id)
      .eq("access_status", "active")
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else setProducts((data || []).map((row) => row.product).filter(Boolean));
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <div>
            <span>ÁREA DO ALUNO</span>
            <h1>Olá, {profile?.full_name || "aluno"}</h1>
          </div>
          <button onClick={signOut}>Sair</button>
        </header>

        {message && <p className="empty">{message}</p>}

        <section className="portal-list" style={{ marginTop: 24 }}>
          <h2>Meus cursos e mentorias</h2>
          {loading ? (
            <p className="empty">Carregando...</p>
          ) : products.length === 0 ? (
            <p className="empty">
              Nenhum acesso liberado ainda. Se você já comprou um produto, aguarde a liberação do administrador
              ou entre em contato pelo WhatsApp informando o e-mail usado no cadastro.
            </p>
          ) : (
            products.map((product) => (
              <article key={product.id}>
                <div>
                  <strong>{product.title}</strong>
                  <span>{product.short_description}</span>
                </div>
                <Link className="portal-home" to={`/minha-area/curso/${product.id}`} style={{ marginTop: 0 }}>
                  Acessar aulas
                </Link>
              </article>
            ))
          )}
        </section>

        <MyCertificates />

        <Link className="portal-home" to="/">Voltar ao site</Link>
      </div>
    </div>
  );
}
