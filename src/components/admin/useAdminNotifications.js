import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../services/supabase";

// Seções sem status de "pendente" natural: o número mostra o que apareceu depois da última vez que você
// abriu aquela tela (guardado só neste navegador). Abrir a tela zera o contador na hora.
const LAST_SEEN_ROUTES = {
  "/admin/usuarios": "usuarios",
  "/admin/pedidos": "pedidos",
};
const lastSeenKey = (badgeKey) => `ha_admin_last_seen_${badgeKey}`;

function getLastSeen(badgeKey) {
  try {
    return localStorage.getItem(lastSeenKey(badgeKey)) || new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function setLastSeenNow(badgeKey) {
  try {
    localStorage.setItem(lastSeenKey(badgeKey), new Date().toISOString());
  } catch {
    // localStorage indisponível (modo privado etc.): sem contador "desde a última vez" pra essa seção, sem travar nada.
  }
}

async function countExact(table, build) {
  const { count, error } = await build(supabase.from(table).select("id", { count: "exact", head: true }));
  return error ? 0 : count || 0;
}

// Comentários não têm status de "não respondido": é preciso olhar a thread (comentário raiz, visível, de
// aluno, sem nenhuma resposta do admin) — a mesma regra que CommentsPage.jsx já usa pra contar pendentes.
async function countComentariosPendentes() {
  const { data, error } = await supabase.from("lesson_comments").select("id,parent_id,author_role,status");
  if (error || !data) return 0;
  const repliedByAdmin = new Set(data.filter((c) => c.parent_id && c.author_role === "admin").map((c) => c.parent_id));
  return data.filter((c) => !c.parent_id && c.status === "visible" && c.author_role !== "admin" && !repliedByAdmin.has(c.id)).length;
}

export default function useAdminNotifications() {
  const location = useLocation();
  const [counts, setCounts] = useState({});

  const refresh = useCallback(async () => {
    const [afiliados, feedbacks, formularios, recuperacao, comentarios, usuarios, pedidos] = await Promise.all([
      countExact("affiliates", (q) => q.eq("status", "pending")),
      countExact("student_feedbacks", (q) => q.eq("status", "review")),
      countExact("form_submissions", (q) => q.eq("pending_manual", true)),
      countExact("orders", (q) => q.in("status", ["pending", "failed"])),
      countComentariosPendentes(),
      countExact("profiles", (q) => q.eq("role", "student").gt("created_at", getLastSeen("usuarios"))),
      countExact("orders", (q) => q.gt("created_at", getLastSeen("pedidos"))),
    ]);
    setCounts({ afiliados, feedbacks, formularios, recuperacao, comentarios, usuarios, pedidos });
  }, []);

  // Ao entrar numa tela com contador "desde a última vez", marca agora como vista e já zera na tela.
  useEffect(() => {
    const badgeKey = LAST_SEEN_ROUTES[location.pathname];
    if (badgeKey) {
      setLastSeenNow(badgeKey);
      setCounts((current) => ({ ...current, [badgeKey]: 0 }));
    }
  }, [location.pathname]);

  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return counts;
}
