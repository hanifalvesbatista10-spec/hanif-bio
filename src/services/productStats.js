// Contagem pública de aulas por produto (product_lesson_counts, SQL 31) e as aulas ao vivo do aluno
// (my_live_lessons, SQL 32). Ambas voltam vazias/sem erro se o SQL ainda não rodou, para não quebrar a tela.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { meetingLive } from "./meeting";

let pendingCounts = null;

export function loadLessonCounts(force = false) {
  if (!pendingCounts || force) {
    pendingCounts = supabase
      .rpc("product_lesson_counts")
      .then(({ data, error }) => {
        if (error || !Array.isArray(data)) return {};
        return Object.fromEntries(data.map((row) => [row.product_id, row.lesson_count]));
      })
      .catch(() => ({}));
  }
  return pendingCounts;
}

export function useLessonCounts() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let alive = true;
    loadLessonCounts().then((value) => alive && setCounts(value));
    return () => {
      alive = false;
    };
  }, []);
  return counts;
}

// Aulas ao vivo que o aluno logado pode ver agora, em qualquer curso com acesso ativo.
export function useMyLiveLessons() {
  const [lives, setLives] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase
      .rpc("my_live_lessons")
      .then(({ data }) => alive && setLives(Array.isArray(data) ? data : []))
      .catch(() => alive && setLives([]));
    return () => {
      alive = false;
    };
  }, []);
  return lives;
}

// Encontros ao vivo (sala do site ou link do Meet) que o aluno pode ver agora. O RLS só devolve os dos cursos dele.
export function useMyLiveMeetings() {
  const [lives, setLives] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase
      .from("live_meetings")
      .select("id,title,starts_at,duration_minutes,ended_at,meet_url,product_id,product:products(title)")
      .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .lte("starts_at", new Date(Date.now() + 30 * 60 * 1000).toISOString())
      .then(({ data, error }) => {
        if (alive) setLives(error ? [] : (data || []).filter((meeting) => meetingLive(meeting)));
      })
      .catch(() => alive && setLives([]));
    return () => {
      alive = false;
    };
  }, []);
  return lives;
}
