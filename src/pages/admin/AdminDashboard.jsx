import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const emptyStats = {
  users: 0,
  students: 0,
  feedbacks: 0,
  published: 0,
  analyses: 0,
  products: 0,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(emptyStats);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const results = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("student_feedbacks").select("id", { count: "exact", head: true }),
        supabase.from("student_feedbacks").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("student_analyses").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      const failed = results.find((item) => item.error);
      if (failed) setError(failed.error.message);

      setStats({
        users: results[0].count || 0,
        students: results[1].count || 0,
        feedbacks: results[2].count || 0,
        published: results[3].count || 0,
        analyses: results[4].count || 0,
        products: results[5].count || 0,
      });
    };

    load();
  }, []);

  return (
    <>
      <div className="admin-build-confirmation">
        Painel V2 carregado corretamente. Os menus e atalhos abaixo são navegáveis.
      </div>

      {error && (
        <div className="admin-alert error">
          Erro ao carregar indicadores: {error}
        </div>
      )}

      <section className="admin-stats">
        {[
          ["Usuários", stats.users],
          ["Alunos", stats.students],
          ["Feedbacks", stats.feedbacks],
          ["Publicados", stats.published],
          ["Análises", stats.analyses],
          ["Produtos ativos", stats.products],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-welcome">
        <h2>Gestão da plataforma</h2>
        <p>
          Cadastre, edite, publique e exclua conteúdos diretamente pelo painel.
        </p>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-button primary"
            onClick={() => navigate("/admin/feedbacks/novo")}
          >
            + Novo feedback
          </button>

          <button
            type="button"
            className="admin-button"
            onClick={() => navigate("/admin/analises/nova")}
          >
            + Nova análise
          </button>

          <button
            type="button"
            className="admin-button"
            onClick={() => navigate("/admin/produtos")}
          >
            Gerenciar produtos
          </button>
        </div>
      </section>
    </>
  );
}
