import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";

const emptyStats = { users: 0, students: 0, feedbacks: 0, published: 0, analyses: 0, products: 0 };

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState(emptyStats);

  useEffect(() => {
    const load = async () => {
      const [users, students, feedbacks, published, analyses, products] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("student_feedbacks").select("id", { count: "exact", head: true }),
        supabase.from("student_feedbacks").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("student_analyses").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      setStats({ users: users.count||0, students: students.count||0, feedbacks: feedbacks.count||0, published: published.count||0, analyses: analyses.count||0, products: products.count||0 });
    };
    load();
  }, []);

  return <div className="admin-page"><aside className="admin-sidebar"><div><b>HANIF ALVES</b><span>PAINEL ADMINISTRATIVO</span></div><nav><a className="active" href="#dashboard">Visão geral</a><a href="#usuarios">Usuários</a><a href="#feedbacks">Feedbacks</a><a href="#analises">Análises</a><a href="#produtos">Produtos</a></nav><Link to="/">Ver site público</Link></aside>
    <main className="admin-main"><header className="admin-top"><div><span>ADMINISTRADOR</span><h1>Olá, {profile?.full_name || "Hanif"}</h1></div><button onClick={signOut}>Sair</button></header>
      <section className="admin-stats" id="dashboard">
        {[ ["Usuários",stats.users], ["Alunos",stats.students], ["Feedbacks",stats.feedbacks], ["Publicados",stats.published], ["Análises",stats.analyses], ["Produtos ativos",stats.products] ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="admin-welcome"><h2>Fundação administrativa instalada</h2><p>Autenticação, funções de usuário, rotas protegidas e banco seguro estão preparados. Nos próximos módulos, os atalhos abaixo receberão os formulários completos de gestão.</p><div className="admin-actions"><button>+ Novo feedback</button><button>+ Nova análise</button><button>Gerenciar produtos</button></div></section>
    </main>
  </div>;
}
