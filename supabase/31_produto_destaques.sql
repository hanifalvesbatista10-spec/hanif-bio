-- DESTAQUES DO PRODUTO E CONTAGEM DE AULAS (cards do site com breves informações)
-- Guarda uma lista curta de benefícios (ex.: "Mentoria semanal ao vivo") para mostrar nos cards do produto,
-- e expõe uma função pública que só devolve a CONTAGEM de aulas publicadas de cada curso (nunca o conteúdo,
-- que continua protegido por RLS e só é lido por quem tem acesso).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva.

alter table public.products add column if not exists highlights text[];

-- Contagem de aulas publicadas por produto (aulas compartilhadas contam uma vez por curso onde aparecem).
-- SECURITY DEFINER: soma sem depender de o visitante ter acesso às aulas; devolve só um número, sem título
-- nem vídeo. Funciona com ou sem a tabela de aulas compartilhadas (SQL 22): sem ela, cai para product_lessons.product_id.
create or replace function public.product_lesson_counts()
returns table (product_id uuid, lesson_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select l.product_id, count(*)::integer
  from public.product_lesson_links l
  join public.product_lessons pl on pl.id = l.lesson_id
  where pl.status = 'published'
  group by l.product_id
$$;

revoke all on function public.product_lesson_counts() from public;
grant execute on function public.product_lesson_counts() to anon, authenticated;
