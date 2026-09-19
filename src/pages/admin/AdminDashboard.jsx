import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { icons } from "../../components/admin/AdminIcons";

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
      <header className="adm-page-head">
        <h2>Visão geral</h2>
        <p>Acompanhe os números principais e vá direto ao que precisa ser atualizado.</p>
      </header>

      {error && (
        <div className="admin-alert error">
          Erro ao carregar indicadores: {error}
        </div>
      )}

      <section className="adm-stats" aria-label="Indicadores">
        <article className="adm-stat">
          <span className="adm-stat-icon">{icons.products}</span>
          <div><span>Produtos</span><strong>{stats.products}</strong></div>
        </article>
        <article className="adm-stat">
          <span className="adm-stat-icon">{icons.feedbacks}</span>
          <div><span>Feedbacks</span><strong>{stats.feedbacks}</strong></div>
        </article>
        <article className="adm-stat">
          <span className="adm-stat-icon">{icons.content}</span>
          <div><span>Publicados</span><strong>{stats.published}</strong></div>
        </article>
      </section>

      <section className="adm-card">
        <h3>Controle do site</h3>
        <p>Gerencie o que o visitante vê sem precisar alterar código ou fazer novo deploy para cada mudança de conteúdo.</p>

        <div className="adm-actions">
          <button type="button" className="admin-button primary" onClick={() => navigate("/admin/site")}>
            Editar página inicial
          </button>
          <button type="button" className="admin-button" onClick={() => navigate("/admin/produtos/novo")}>
            + Novo produto
          </button>
          <button type="button" className="admin-button" onClick={() => navigate("/admin/feedbacks/novo")}>
            + Novo feedback
          </button>
        </div>
      </section>

      <p className="adm-meta adm-note">
        Versão comercial ativa: site público, produtos, feedbacks e conteúdo geral sob seu controle.
      </p>
    </>
  );
}
