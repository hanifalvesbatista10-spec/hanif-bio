// Aulas compartilhadas: uma aula pode estar em vários cursos (tabela product_lesson_links),
// cada curso com a sua ordem. Se o banco ainda não tem a tabela (SQL 22), tudo cai no modo antigo: uma aula, um curso.
import { supabase } from "./supabase";

export function byOrder(a, b) {
  return (Number(a.position) - Number(b.position)) || String(a.created_at || "").localeCompare(String(b.created_at || ""));
}

// Painel: todas as aulas e todas as ligações. `sharing` diz se o compartilhamento está disponível no banco.
export async function fetchLessonsAndLinks() {
  const [lessonsResult, linksResult] = await Promise.all([
    supabase.from("product_lessons").select("*"),
    supabase.from("product_lesson_links").select("lesson_id,product_id,position"),
  ]);
  if (lessonsResult.error) return { error: lessonsResult.error, lessons: [], links: [], sharing: false };
  const lessons = lessonsResult.data || [];
  if (linksResult.error) {
    return {
      lessons,
      sharing: false,
      links: lessons.filter((lesson) => lesson.product_id).map((lesson) => ({ lesson_id: lesson.id, product_id: lesson.product_id, position: lesson.position })),
    };
  }
  return { lessons, links: linksResult.data || [], sharing: true };
}

// Aulas de um curso, na ordem do curso (a posição vem da ligação, não da aula)
export function lessonsForProduct(lessons, links, productId) {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return links
    .filter((link) => link.product_id === productId)
    .map((link) => (byId.has(link.lesson_id) ? { ...byId.get(link.lesson_id), position: link.position } : null))
    .filter(Boolean)
    .sort(byOrder);
}

export const productIdsOfLesson = (links, lessonId) => links.filter((link) => link.lesson_id === lessonId).map((link) => link.product_id);

// Área do aluno e prévia do painel: aulas de um curso (o banco só entrega as publicadas ao aluno)
export async function fetchProductLessons(productId) {
  const shared = await supabase
    .from("product_lesson_links")
    .select("position,lesson:product_lessons(*)")
    .eq("product_id", productId)
    .order("position", { ascending: true });
  if (!shared.error) {
    const data = (shared.data || [])
      .filter((row) => row.lesson)
      .map((row) => ({ ...row.lesson, position: row.position }))
      .sort(byOrder);
    return { data, error: null };
  }
  // modo antigo (banco sem a tabela de ligações)
  const legacy = await supabase.from("product_lessons").select("*").eq("product_id", productId).order("position", { ascending: true });
  return { data: legacy.data || [], error: legacy.error };
}
