-- HANIF ALVES — BUSCA, FILTROS E PÁGINAS NA LISTA DE USUÁRIOS
-- A tela de Usuários e a de Acessos passam a pedir ao banco só a página que estão mostrando (em vez de baixar todos os cadastros,
-- o que no Supabase para em 1000 linhas e esconderia o resto sem avisar). Duas funções, ambas SÓ PARA ADMINISTRADOR
-- (quem não é admin recebe erro; aluno e parceiro não enxergam ninguém):
--   admin_list_users(...)    -> uma página de usuários, já com busca (sem diferenciar acento), filtros, ordenação,
--                               número de cursos ativos de cada um e o total que bate com o filtro;
--   admin_users_summary()    -> os contadores do topo (total, novos da semana, sem curso, bloqueados).
-- Não altera nem apaga dados. Execute no SQL Editor do Supabase.

create extension if not exists unaccent with schema extensions;

create or replace function public.admin_list_users(
  p_search text default '',
  p_role text default '',
  p_status text default '',
  p_has_course text default 'any',      -- any | with | without
  p_product uuid default null,          -- só quem tem acesso ativo a este curso
  p_since_days integer default null,    -- só cadastrados nos últimos N dias
  p_sort text default 'recent',         -- recent | oldest | name | access
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  phone text,
  role public.user_role,
  account_status public.account_status,
  created_at timestamptz,
  last_access timestamptz,
  course_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  words text[];
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem listar usuários.' using errcode = '42501';
  end if;

  -- cada palavra digitada precisa aparecer no nome, e-mail ou telefone (sem acento, sem diferenciar maiúsculas);
  -- % _ e \ digitados são tratados como texto comum
  words := array(
    select replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_')
    from unnest(string_to_array(lower(extensions.unaccent(coalesce(p_search, ''))), ' ')) as w
    where btrim(w) <> ''
  );

  return query
  select
    p.id, p.full_name, p.email, p.phone, p.role, p.account_status, p.created_at, p.last_access,
    (select count(*) from public.user_products up where up.user_id = p.id and up.access_status = 'active') as course_count,
    count(*) over () as total_count
  from public.profiles p
  where
    (cardinality(words) = 0 or not exists (
      select 1 from unnest(words) as w
      where lower(extensions.unaccent(coalesce(p.full_name, '') || ' ' || coalesce(p.email, '') || ' ' || coalesce(p.phone, '')))
            not like '%' || w || '%' escape '\'
    ))
    and (coalesce(p_role, '') = '' or p.role::text = p_role)
    and (coalesce(p_status, '') = '' or p.account_status::text = p_status)
    and (p_since_days is null or p.created_at >= now() - make_interval(days => p_since_days))
    and (coalesce(p_has_course, 'any') = 'any'
         or (p_has_course = 'with' and exists (select 1 from public.user_products up where up.user_id = p.id and up.access_status = 'active'))
         or (p_has_course = 'without' and not exists (select 1 from public.user_products up where up.user_id = p.id and up.access_status = 'active')))
    and (p_product is null or exists (select 1 from public.user_products up where up.user_id = p.id and up.product_id = p_product and up.access_status = 'active'))
  order by
    (case when p_sort = 'name' then lower(coalesce(p.full_name, p.email)) end) asc nulls last,
    (case when p_sort = 'access' then p.last_access end) desc nulls last,
    (case when p_sort = 'oldest' then p.created_at end) asc,
    p.created_at desc,
    p.id
  limit greatest(1, least(coalesce(p_limit, 25), 500))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.admin_users_summary()
returns table (total bigint, new_week bigint, without_course bigint, blocked bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem ver este resumo.' using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where p.created_at >= now() - interval '7 days')::bigint,
    count(*) filter (where p.role::text <> 'admin' and not exists (
      select 1 from public.user_products up where up.user_id = p.id and up.access_status = 'active'
    ))::bigint,
    count(*) filter (where p.account_status::text = 'blocked')::bigint
  from public.profiles p;
end;
$$;

revoke all on function public.admin_list_users(text, text, text, text, uuid, integer, text, integer, integer) from public, anon;
revoke all on function public.admin_users_summary() from public, anon;
grant execute on function public.admin_list_users(text, text, text, text, uuid, integer, text, integer, integer) to authenticated;
grant execute on function public.admin_users_summary() to authenticated;
