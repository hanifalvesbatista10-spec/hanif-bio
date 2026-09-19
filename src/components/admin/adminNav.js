// Rotas reais do painel, agrupadas. O primeiro item não tem rótulo de grupo.
export const adminNavGroups = [
  {
    label: null,
    items: [{ to: "/admin", label: "Visão geral", icon: "dashboard", end: true }],
  },
  {
    label: "Site",
    items: [
      { to: "/admin/site", label: "Conteúdo do site", icon: "site" },
      { to: "/admin/produtos", label: "Produtos", icon: "products" },
      { to: "/admin/conteudos", label: "Conteúdos e materiais", icon: "content" },
      { to: "/admin/faq", label: "Perguntas frequentes", icon: "faq" },
      { to: "/admin/feedbacks", label: "Feedbacks", icon: "feedbacks" },
    ],
  },
  {
    label: "Área de membros",
    items: [
      { to: "/admin/area-de-membros", label: "Ver como aluno", icon: "preview" },
      { to: "/admin/aulas", label: "Aulas", icon: "lessons" },
      { to: "/admin/auditoria", label: "Auditoria das aulas", icon: "audit" },
      { to: "/admin/comentarios", label: "Comentários", icon: "comments" },
      { to: "/admin/acessos", label: "Acessos dos alunos", icon: "access" },
      { to: "/admin/usuarios", label: "Usuários", icon: "users" },
    ],
  },
  {
    label: "Engajamento",
    items: [
      { to: "/admin/formularios", label: "Formulários e atividades", icon: "forms" },
      { to: "/admin/inscricoes", label: "Inscrições do evento", icon: "events" },
    ],
  },
];

const allItems = adminNavGroups.flatMap((group) => group.items);

export function resolveAdminTitle(pathname) {
  const match = allItems
    .filter((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match ? match.label : "Painel";
}
