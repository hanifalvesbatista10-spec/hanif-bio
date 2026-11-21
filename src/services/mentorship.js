import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Destino do "Conhecer a mentoria" (abertura da home e cabeçalho): o primeiro produto ATIVO cujo título tem "mentoria",
// na ordem do cadastro. Assim o link acompanha o produto real (o endereço não fica escrito no código) e nunca aponta para
// uma página sem produto. Sem resultado, quem usa cai no catálogo (#produtos).
let cached = null;

export function fetchMentorshipSlug() {
  if (!cached) {
    cached = supabase
      .from("products")
      .select("slug")
      .eq("status", "active")
      .ilike("title", "%mentoria%")
      .order("display_order", { ascending: true })
      .limit(1)
      .then(
        ({ data, error }) => {
          if (error) cached = null; // tenta de novo na próxima vez
          return error ? null : data?.[0]?.slug || null;
        },
        () => {
          cached = null;
          return null;
        }
      );
  }
  return cached;
}

// "/produto/<slug>" quando existe, senão `fallback`.
export function useMentorshipHref(fallback = null) {
  const [slug, setSlug] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchMentorshipSlug().then((value) => {
      if (alive) setSlug(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return slug ? `/produto/${slug}` : fallback;
}
