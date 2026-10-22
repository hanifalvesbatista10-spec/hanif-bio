// Conclusão de aula (SQL 55): o aluno marca ("manual") ou o vídeo marca sozinho no fim ("auto").
// O banco só deixa cada aluno ver e mexer nas próprias marcações. Sem a tabela, `available` vem falso e a tela esconde a caixinha.
import { supabase } from "./supabase";

// Aulas já concluídas pelo aluno logado, entre as que foram pedidas.
export async function fetchCompletedLessons(lessonIds) {
  if (!lessonIds.length) return { ids: new Set(), available: true };
  const { data, error } = await supabase.from("lesson_progress").select("lesson_id").in("lesson_id", lessonIds);
  if (error) return { ids: new Set(), available: false };
  return { ids: new Set((data || []).map((row) => row.lesson_id)), available: true };
}

// Marca ou desmarca. Marcar duas vezes não dá erro (continua uma marcação só).
export async function setLessonCompleted({ userId, lessonId, completed, source = "manual" }) {
  if (completed) {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({ user_id: userId, lesson_id: lessonId, source }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
    return error;
  }
  const { error } = await supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId);
  return error;
}
