import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, feedbacks: 0, published: 0 });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const results = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("student_feedbacks").select("id", { count: "exact", head: true }),
        supabase
          .from("student_feedbacks")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .eq("publication_authorized", true),
      ]);

      const failed = results.find((item) => item.error);
      if (failed) setError(failed.error.message);

      setStats({
        products: results[0].count || 0,
        feedbacks: results[1].count || 0,
        published: results[2].count || 0,
      });
    };

    load();
  }, []);

  return (
    <>
      <div className="admin-build-confirmation">
        V4 comercial ativa: site público, produtos, feedbacks e conteúdo geral sob seu controle.
      </div>

      {error && (
        <div className="admin-alert error">
          Erro ao carregar indicadores: {error}
        </div>
      )}

      <section className="admin-stats">
        <article><span>Produtos</span><strong>{stats.products}</strong></article>
        <article><span>Feedbacks</span><strong>{stats.feedbacks}</strong></article>
        <article><span>Publicados</span><strong>{stats.published}</strong></article>
      </section>

      <section className="admin-welcome">
        <h2>Controle do site</h2>
        <p>Gerencie o que o visitante vê sem precisar alterar código ou fazer novo deploy para cada mudança de conteúdo.</p>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-button primary"
            onClick={() => navigate("/admin/site")}
          >
            Editar página inicial
          </button>

          <button
            type="button"
            className="admin-button"
            onClick={() => navigate("/admin/produtos/novo")}
          >
            + Novo produto
          </button>

          <button
            type="button"
            className="admin-button"
            onClick={() => navigate("/admin/feedbacks/novo")}
          >
            + Novo feedback
          </button>
        </div>
      </section>
    </>
  );
}
