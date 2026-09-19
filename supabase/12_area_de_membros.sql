-- ÁREA DE MEMBROS — AULAS GRAVADAS POR PRODUTO
-- Cria a tabela de aulas (vídeo hospedado no YouTube por enquanto) e protege
-- o acesso: só administradores e alunos com acesso liberado ao produto
-- (tabela public.user_products, que já existe desde a fundação do banco)
-- conseguem ver as aulas publicadas. Ninguém não autenticado enxerga nada.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: cria só uma tabela nova.

create table if not exists public.product_lessons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  description text,
  video_url text not null,
  video_provider text not null default 'youtube',
  duration text,
  position integer not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_lessons_product_idx on public.product_lessons(product_id, position);

drop trigger if exists product_lessons_updated on public.product_lessons;
create trigger product_lessons_updated before update on public.product_lessons
for each row execute function public.set_updated_at();

alter table public.product_lessons enable row level security;

-- Sem acesso anônimo: só quem está autenticado (aluno com acesso liberado, ou admin).
drop policy if exists "students with access read lessons" on public.product_lessons;
create policy "students with access read lessons"
on public.product_lessons for select
to authenticated
using (
  public.is_admin()
  or (
    status = 'published'
    and exists (
      select 1 from public.user_products up
      where up.product_id = product_lessons.product_id
        and up.user_id = auth.uid()
        and up.access_status = 'active'
    )
  )
);

drop policy if exists "admin lessons full" on public.product_lessons;
create policy "admin lessons full"
on public.product_lessons for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.product_lessons;
exception
  when duplicate_object then null;
end $$;
