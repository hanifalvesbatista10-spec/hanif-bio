// Presença para o certificado (SQL 55 e 56). O certificado continua sendo emitido à mão: aqui só ficam o registro e as contas.
// Aluno: marca presença em encontro ao vivo (função do banco, só dentro da janela) e em aula ao vivo (conclusão com origem "live").
// Painel: lê a turma toda e ajusta marcações à mão.
import { supabase } from "./supabase";
import { fetchAllRows as fetchAll } from "./paging";
import { fetchProductLessons, fetchProductModules, flattenGroups, groupByModule } from "./lessons";

const HOUR = 60 * 60 * 1000;

// Janela de presença: do início do encontro até 1 hora depois do fim (mesma regra do banco).
export function presenceWindow(meeting, now = Date.now()) {
  const start = new Date(meeting.starts_at).getTime();
  // com encerramento antecipado (SQL 57), o prazo conta a partir dele
  const end = meeting.ended_at ? new Date(meeting.ended_at).getTime() : start + meeting.duration_minutes * 60 * 1000;
  if (now < start) return "soon";
  if (now > end + HOUR) return "closed";
  return "open";
}

// Devolve { marked_at } ou { error } com a mensagem do banco em português.
export async function markMeetingAttendance(meetingId) {
  const { data, error } = await supabase.rpc("mark_meeting_attendance", { p_meeting_id: meetingId });
  if (error) return { error: error.message || "Não foi possível marcar a presença. Tente de novo." };
  return { marked_at: data };
}

// Encontros do curso que já começaram, e a presença do aluno logado neles (para o "2 de 3").
export async function fetchMyMeetingPresence(productId) {
  const { data: meetings, error } = await supabase
    .from("live_meetings")
    .select("id,title,starts_at,duration_minutes,ended_at")
    .eq("product_id", productId)
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) return { meetings: [], marked: new Set(), available: false };
  const ids = (meetings || []).map((meeting) => meeting.id);
  if (!ids.length) return { meetings: [], marked: new Set(), available: true };
  const { data: rows, error: rowsError } = await supabase.from("meeting_attendance").select("meeting_id").in("meeting_id", ids);
  if (rowsError) return { meetings: [], marked: new Set(), available: false };
  return { meetings: meetings || [], marked: new Set((rows || []).map((row) => row.meeting_id)), available: true };
}

// Painel: tudo o que é preciso para ver a presença de um curso.
// Conta só aulas publicadas e encontros que já começaram. `progress` e `attendance` são mapas "aluno:item" → registro.
export async function fetchCourseAttendance(productId) {
  const [lessonResult, moduleList, meetingResult, grantResult] = await Promise.all([
    fetchProductLessons(productId),
    fetchProductModules(productId),
    supabase
      .from("live_meetings")
      .select("id,title,starts_at,duration_minutes")
      .eq("product_id", productId)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
    supabase.from("user_products").select("user_id,profile:profiles!user_id(id,full_name,email)").eq("product_id", productId).eq("access_status", "active"),
  ]);
  if (lessonResult.error) return { error: lessonResult.error.message };
  if (grantResult.error) return { error: grantResult.error.message };

  const published = (lessonResult.data || []).filter((lesson) => lesson.status === "published");
  const lessons = flattenGroups(groupByModule(published, moduleList));
  const meetings = meetingResult.error ? [] : meetingResult.data || [];
  const students = (grantResult.data || [])
    .map((grant) => grant.profile)
    .filter(Boolean)
    .sort((a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email), "pt-BR"));

  const lessonIds = lessons.map((lesson) => lesson.id);
  const meetingIds = meetings.map((meeting) => meeting.id);
  const [progressResult, attendanceResult] = await Promise.all([
    lessonIds.length
      ? fetchAll(() => supabase.from("lesson_progress").select("user_id,lesson_id,source,completed_at").in("lesson_id", lessonIds).order("user_id").order("lesson_id"))
      : { data: [] },
    meetingIds.length
      ? fetchAll(() => supabase.from("meeting_attendance").select("user_id,meeting_id,source,marked_at").in("meeting_id", meetingIds).order("user_id").order("meeting_id"))
      : { data: [] },
  ]);
  if (progressResult.error) return { error: progressResult.error.message };
  if (attendanceResult.error) return { error: attendanceResult.error.message };

  const progress = new Map((progressResult.data || []).map((row) => [`${row.user_id}:${row.lesson_id}`, row]));
  const attendance = new Map((attendanceResult.data || []).map((row) => [`${row.user_id}:${row.meeting_id}`, row]));
  return { lessons, meetings, students, progress, attendance };
}

// Contas de um aluno: aulas concluídas e encontros com presença.
export function studentTotals(data, studentId) {
  const lessonsDone = data.lessons.filter((lesson) => data.progress.has(`${studentId}:${lesson.id}`)).length;
  const meetingsDone = data.meetings.filter((meeting) => data.attendance.has(`${studentId}:${meeting.id}`)).length;
  const lessonsTotal = data.lessons.length;
  return {
    lessonsDone,
    lessonsTotal,
    lessonsPercent: lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0,
    meetingsDone,
    meetingsTotal: data.meetings.length,
  };
}

// Cumpriu o mínimo que o administrador digitou na hora? (percentual de aulas e número de encontros)
export const meetsMinimum = (totals, { minPercent, minMeetings }) =>
  totals.lessonsPercent >= minPercent && totals.meetingsDone >= Math.min(minMeetings, totals.meetingsTotal);

// Marcação feita à mão pelo painel (origem "admin"); desmarcar apaga a linha.
export async function setLessonMark({ studentId, lessonId, marked }) {
  if (marked) {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({ user_id: studentId, lesson_id: lessonId, source: "admin" }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
    return error;
  }
  const { error } = await supabase.from("lesson_progress").delete().eq("user_id", studentId).eq("lesson_id", lessonId);
  return error;
}

export async function setMeetingMark({ studentId, meetingId, marked }) {
  if (marked) {
    const { error } = await supabase
      .from("meeting_attendance")
      .upsert({ user_id: studentId, meeting_id: meetingId, source: "admin" }, { onConflict: "user_id,meeting_id", ignoreDuplicates: true });
    return error;
  }
  const { error } = await supabase.from("meeting_attendance").delete().eq("user_id", studentId).eq("meeting_id", meetingId);
  return error;
}
