import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";

const emptyStats = { users: 0, students: 0, feedbacks: 0, published: 0, analyses: 0, products: 0 };

export default function AdminDashboard() {
  const [stats, setStats] = useState(emptyStats);
  const [error, setError] = useState("");

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

  return <>
    {error && <div className="admin-alert error">Erro ao carregar indicadores: {error}</div>}
    <section className="admin-stats">
      {[ ["Usuários",stats.users], ["Alunos",stats.students], ["Feedbacks",stats.feedbacks], ["Publicados",stats.published], ["Análises",stats.analyses], ["Produtos ativos",stats.products] ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <section className="admin-welcome">
      <h2>Gestão da plataforma</h2>
      <p>Use os atalhos abaixo ou o menu lateral para cadastrar, editar, publicar e excluir conteúdos.</p>
      <div className="admin-actions">
        <Link className="admin-button primary" to="/admin/feedbacks/novo">+ Novo feedback</Link>
        <Link className="admin-button" to="/admin/analises/nova">+ Nova análise</Link>
        <Link className="admin-button" to="/admin/produtos">Gerenciar produtos</Link>
      </div>
    </section>
  </>;
}
