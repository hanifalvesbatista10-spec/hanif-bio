-- HANIF ALVES — ENCONTROS AO VIVO (REUNIÕES DENTRO DA ÁREA DE MEMBROS)
-- Agenda de reuniões por produto. A sala em si é criada no Daily.co pelo servidor (api/meeting.js) no
-- primeiro acesso; aqui fica só a agenda. O aluno vê os encontros dos produtos em que tem acesso ativo.
-- Execute no SQL Editor do Supabase.

create table if not exists public.live_meetings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  duration_minutes integer not null default 90 check (duration_minutes between 15 and 480),
  created_at timestamptz not null default now()
);

create index if not exists live_meetings_product_idx on public.live_meetings (product_id, starts_at);

alter table public.live_meetings enable row level security;

drop policy if exists "live meetings admin full" on public.live_meetings;
create policy "live meetings admin full" on public.live_meetings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "live meetings students read" on public.live_meetings;
create policy "live meetings students read" on public.live_meetings
  for select to authenticated
  using (
    exists (
      select 1 from public.user_products up
      where up.user_id = auth.uid()
        and up.product_id = live_meetings.product_id
        and up.access_status = 'active'
    )
  );
