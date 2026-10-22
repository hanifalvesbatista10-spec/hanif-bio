// Aulas compartilhadas: uma aula pode estar em vários cursos (tabela product_lesson_links),
// cada curso com a sua ordem. Se o banco ainda não tem a tabela (SQL 22), tudo cai no modo antigo: uma aula, um curso.
import { supabase } from "./supabase";

export function byOrder(a, b) {
  return (Number(a.position) - Number(b.position)) || String(a.created_at || "").localeCompare(String(b.created_at || ""));
}

// Painel: todas as aulas e todas as ligações. `sharing` diz se o compartilhamento está disponível no banco.
export async function fetchLessonsAndLinks() {
  const [lessonsResult, withModule, withHold] = await Promise.all([
    supabase.from("product_lessons").select("*"),
    supabase.from("product_lesson_links").select("lesson_id,product_id,position,available_in_hold,module_id"),
    supabase.from("product_lesson_links").select("lesson_id,product_id,position,available_in_hold"),
  ]);
  if (lessonsResult.error) return { error: lessonsResult.error, lessons: [], links: [], sharing: false, holdAvailable: false, modulesAvailable: false };
  const lessons = lessonsResult.data || [];
  // module_id (SQL 55, módulos) é opcional: sem ele tudo segue como antes, só sem módulos.
  const modulesAvailable = !withModule.error;
  // available_in_hold (SQL 30, garantia de 7 dias) é opcional: se ainda não existe, tenta de novo sem ele
  // em vez de derrubar o compartilhamento inteiro (SQL 22), que não depende dela.
  const holdAvailable = modulesAvailable || !withHold.error;
  const linksResult = modulesAvailable ? withModule : holdAvailable ? withHold : await supabase.from("product_lesson_links").select("lesson_id,product_id,position");
  if (linksResult.error) {
    return {
      lessons,
      sharing: false,
      holdAvailable: false,
      modulesAvailable: false,
      links: lessons.filter((lesson) => lesson.product_id).map((lesson) => ({ lesson_id: lesson.id, product_id: lesson.product_id, position: lesson.position, available_in_hold: false, module_id: null })),
    };
  }
  return { lessons, links: (linksResult.data || []).map((link) => ({ available_in_hold: false, module_id: null, ...link })), sharing: true, holdAvailable, modulesAvailable };
}

// Módulos de todos os cursos (SQL 55). Sem a tabela, devolve lista vazia e o painel esconde a parte de módulos.
export async function fetchModules() {
  const { data, error } = await supabase.from("product_modules").select("id,product_id,title,position,created_at");
  return { modules: error ? [] : data || [], available: !error };
}

// Aulas de um curso, na ordem do curso (a posição vem da ligação, não da aula)
export function lessonsForProduct(lessons, links, productId) {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return links
    .filter((link) => link.product_id === productId)
    .map((link) => (byId.has(link.lesson_id) ? { ...byId.get(link.lesson_id), position: link.position, available_in_hold: Boolean(link.available_in_hold), module_id: link.module_id || null } : null))
    .filter(Boolean)
    .sort(byOrder);
}

export const productIdsOfLesson = (links, lessonId) => links.filter((link) => link.lesson_id === lessonId).map((link) => link.product_id);

// Área do aluno e prévia do painel: aulas de um curso (o banco só entrega as publicadas ao aluno)
export async function fetchProductLessons(productId) {
  let shared = await supabase
    .from("product_lesson_links")
    .select("position,module_id,lesson:product_lessons(*)")
    .eq("product_id", productId)
    .order("position", { ascending: true });
  // banco sem módulos (SQL 55): tenta de novo sem a coluna
  if (shared.error) {
    shared = await supabase
      .from("product_lesson_links")
      .select("position,lesson:product_lessons(*)")
      .eq("product_id", productId)
      .order("position", { ascending: true });
  }
  if (!shared.error) {
    const data = (shared.data || [])
      .filter((row) => row.lesson)
      .map((row) => ({ ...row.lesson, position: row.position, module_id: row.module_id || null }))
      .sort(byOrder);
    return { data, error: null };
  }
  // modo antigo (banco sem a tabela de ligações)
  const legacy = await supabase.from("product_lessons").select("*").eq("product_id", productId).order("position", { ascending: true });
  return { data: legacy.data || [], error: legacy.error };
}

// Módulos de um curso, na ordem. Sem a tabela (SQL 55) devolve vazio.
export async function fetchProductModules(productId) {
  const { data, error } = await supabase
    .from("product_modules")
    .select("id,title,position,created_at")
    .eq("product_id", productId)
    .order("position", { ascending: true });
  return error ? [] : (data || []).sort(byOrder);
}

// Agrupa as aulas de um curso por módulo, na ordem de exibição: primeiro as aulas sem módulo (sem cabeçalho), depois cada módulo
// na sua ordem. Módulo sem aulas só aparece quando `keepEmpty` (painel); o aluno não vê módulo vazio.
export function groupByModule(lessons, modules, { keepEmpty = false } = {}) {
  const sortedModules = modules.slice().sort(byOrder);
  const known = new Set(sortedModules.map((item) => item.id));
  const sorted = lessons.slice().sort(byOrder);
  const groups = [];
  const loose = sorted.filter((lesson) => !lesson.module_id || !known.has(lesson.module_id));
  if (loose.length) groups.push({ module: null, lessons: loose });
  for (const item of sortedModules) {
    const inside = sorted.filter((lesson) => lesson.module_id === item.id);
    if (inside.length || keepEmpty) groups.push({ module: item, lessons: inside });
  }
  return groups;
}

// A mesma ordem, em uma lista só (é a ordem do "Próxima aula" do aluno e a que o painel renumera).
export const flattenGroups = (groups) => groups.flatMap((group) => group.lessons);

// O selo "ao vivo" de uma aula vale por 6 horas (SQL 32); a presença "ao vivo" (SQL 56) usa a mesma janela.
export function isLiveFresh(lesson) {
  return Boolean(lesson.is_live && lesson.live_started_at && Date.now() - new Date(lesson.live_started_at).getTime() < 6 * 60 * 60 * 1000);
}
