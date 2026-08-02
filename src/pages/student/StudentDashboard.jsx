import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";

export default function StudentDashboard() {
  const { profile, signOut } = useAuth();
  const [analyses, setAnalyses] = useState([]);

  useEffect(() => {
    supabase.from("student_analyses").select("id,title,analysis_date,performance_level,status").order("analysis_date", { ascending: false })
      .then(({ data }) => setAnalyses(data || []));
  }, []);

  return <div className="portal-page"><div className="portal-shell">
    <header className="portal-header"><div><span>MEU DESENVOLVIMENTO</span><h1>Olá, {profile?.full_name || "aluno"}</h1></div><button onClick={signOut}>Sair</button></header>
    <div className="portal-grid">
      <section className="portal-card"><h2>Minhas análises</h2><strong>{analyses.length}</strong><p>Somente análises liberadas para sua conta aparecem aqui.</p></section>
      <section className="portal-card"><h2>Status da conta</h2><strong>Ativa</strong><p>Seu acesso está liberado.</p></section>
      <section className="portal-card"><h2>Perfil</h2><strong>{profile?.role === "student" ? "Aluno" : "Usuário"}</strong><p>{profile?.email}</p></section>
    </div>
    <section className="portal-list"><h2>Análises liberadas</h2>{analyses.length === 0 ? <p className="empty">Nenhuma análise foi liberada para você ainda.</p> : analyses.map(a=><article key={a.id}><div><strong>{a.title}</strong><span>{a.performance_level || "Sem classificação"}</span></div><time>{a.analysis_date ? new Date(a.analysis_date).toLocaleDateString("pt-BR") : ""}</time></article>)}</section>
    <Link className="portal-home" to="/">Voltar ao site</Link>
  </div></div>;
}
