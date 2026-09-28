-- GARANTIA DE 7 DIAS (direito de arrependimento, art. 49 do CDC)
-- Nos primeiros 7 dias depois da compra, o aluno só vê as aulas que você marcar como "amostra"; o resto
-- libera sozinho quando os 7 dias passam, ou na hora se você liberar manualmente. A ideia é reduzir o
-- pedido de reembolso de quem assiste ao curso inteiro e devolve dentro do prazo legal.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 22_aulas_compartilhadas.sql já executada).

-- 1) por curso: liga/desliga a garantia (produtos sem risco de reembolso, como conteúdo gratuito, podem desligar)
alter table public.products add column if not exists access_hold_enabled boolean not null default true;

-- 2) por aluno+curso: quando alguém libera tudo antes da hora (o início da garantia já existe: user_products.granted_at)
alter table public.user_products add column if not exists hold_released_at timestamptz;
alter table public.user_products add column if not exists hold_released_by uuid references public.profiles(id) on delete set null;

-- 3) por aula+curso: esta aula aparece mesmo durante os 7 dias (ex.: as primeiras aulas, como amostra)
alter table public.product_lesson_links add column if not exists available_in_hold boolean not null default false;

-- 4) o período de garantia deste acesso ainda está valendo?
create or replace function public.access_hold_active(p_granted_at timestamptz, p_released_at timestamptz, p_hold_enabled boolean)
returns boolean
language sql
immutable
as $$
  select p_hold_enabled and p_released_at is null and now() < p_granted_at + interval '7 days';
$$;

grant execute on function public.access_hold_active(timestamptz, timestamptz, boolean) to authenticated, anon;

-- 5) leitura das aulas: durante a garantia, só as marcadas como amostra (substitui a política da SQL 22)
drop policy if exists "students with access read lessons" on public.product_lessons;
create policy "students with access read lessons"
on public.product_lessons for select
to authenticated
using (
  public.is_admin()
  or (
    status = 'published'
    and exists (
      select 1
      from public.product_lesson_links l
      join public.user_products up on up.product_id = l.product_id
      join public.products p on p.id = l.product_id
      where l.lesson_id = product_lessons.id
        and up.user_id = auth.uid()
        and up.access_status = 'active'
        and (l.available_in_hold or not public.access_hold_active(up.granted_at, up.hold_released_at, p.access_hold_enabled))
    )
  )
);

-- 6) mesma regra para comentários e vídeo protegido (Mux), que chamam esta função (substitui a da SQL 22)
create or replace function public.can_access_lesson(target_lesson uuid)
returns boolean
stable
security definer
set search_path = public
language sql
as $$
  select exists (
    select 1
    from public.product_lessons l
    join public.product_lesson_links pl on pl.lesson_id = l.id
    join public.user_products up on up.product_id = pl.product_id
    join public.products p on p.id = pl.product_id
    where l.id = target_lesson
      and l.status = 'published'
      and up.user_id = auth.uid()
      and up.access_status = 'active'
      and (pl.available_in_hold or not public.access_hold_active(up.granted_at, up.hold_released_at, p.access_hold_enabled))
  );
$$;

grant execute on function public.can_access_lesson(uuid) to authenticated;

-- 7) RPC: resumo da garantia para a área do aluno (quantas aulas já dá para ver, quando libera tudo)
create or replace function public.my_access_hold(p_product_id uuid)
returns table (in_hold boolean, release_at timestamptz, total_lessons integer, visible_lessons integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.access_hold_active(up.granted_at, up.hold_released_at, p.access_hold_enabled),
    up.granted_at + interval '7 days',
    (
      select count(*) from public.product_lesson_links l
      join public.product_lessons pl2 on pl2.id = l.lesson_id
      where l.product_id = p_product_id and pl2.status = 'published'
    ),
    (
      select count(*) from public.product_lesson_links l
      join public.product_lessons pl2 on pl2.id = l.lesson_id
      where l.product_id = p_product_id and pl2.status = 'published'
        and (l.available_in_hold or not public.access_hold_active(up.granted_at, up.hold_released_at, p.access_hold_enabled))
    )
  from public.user_products up
  join public.products p on p.id = up.product_id
  where up.user_id = auth.uid() and up.product_id = p_product_id and up.access_status = 'active';
$$;

revoke all on function public.my_access_hold(uuid) from public, anon;
grant execute on function public.my_access_hold(uuid) to authenticated;
