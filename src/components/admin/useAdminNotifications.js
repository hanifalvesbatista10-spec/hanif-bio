import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../services/supabase";

// Cada seção mostra só o que é NOVO desde a última vez que você abriu aquela tela (guardado neste
// navegador) — não o total acumulado. Assim um pedido de teste antigo parado em "aguardando" não fica
// aparecendo pra sempre: ele só conta uma vez, até você abrir a tela, e depois some do contador.
const BADGES = [
  { key: "pedidos", route: "/admin/pedidos", table: "orders", timeCol: "created_at" },
  {
    key: "recuperacao",
    route: "/admin/recuperacao-de-vendas",
    table: "orders",
    timeCol: "created_at",
    build: (q) => q.in("status", ["pending", "failed"]),
  },
  { key: "afiliados", route: "/admin/afiliados", table: "affiliates", timeCol: "created_at" },
  {
    key: "feedbacks",
    route: "/admin/feedbacks",
    table: "student_feedbacks",
    timeCol: "created_at",
    build: (q) => q.eq("status", "review"),
  },
  {
    key: "formularios",
    route: "/admin/formularios",
    table: "form_submissions",
    timeCol: "submitted_at",
    build: (q) => q.eq("pending_manual", true),
  },
  {
    key: "comentarios",
    route: "/admin/comentarios",
    table: "lesson_comments",
    timeCol: "created_at",
    build: (q) => q.neq("author_role", "admin").eq("status", "visible"),
  },
  {
    key: "usuarios",
    route: "/admin/usuarios",
    table: "profiles",
    timeCol: "created_at",
    build: (q) => q.eq("role", "student"),
  },
];

const LAST_SEEN_ROUTES = Object.fromEntries(BADGES.map((b) => [b.route, b.key]));
const lastSeenStorageKey = (badgeKey) => `ha_admin_last_seen_${badgeKey}`;

function getLastSeen(badgeKey) {
  try {
    return localStorage.getItem(lastSeenStorageKey(badgeKey)) || new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function setLastSeenNow(badgeKey) {
  try {
    localStorage.setItem(lastSeenStorageKey(badgeKey), new Date().toISOString());
  } catch {
    // localStorage indisponível (modo privado etc.): sem contador pra essa seção, sem travar nada.
  }
}

async function countNew(badge) {
  let query = supabase.from(badge.table).select("id", { count: "exact", head: true }).gt(badge.timeCol, getLastSeen(badge.key));
  if (badge.build) query = badge.build(query);
  const { count, error } = await query;
  return error ? 0 : count || 0;
}

export default function useAdminNotifications() {
  const location = useLocation();
  const [counts, setCounts] = useState({});

  const refresh = useCallback(async () => {
    const entries = await Promise.all(BADGES.map(async (badge) => [badge.key, await countNew(badge)]));
    setCounts(Object.fromEntries(entries));
  }, []);

  // Ao entrar numa tela com contador, marca agora como vista e já zera na tela.
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
