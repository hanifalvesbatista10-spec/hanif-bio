-- HANIF ALVES — MÓDULOS, CONCLUSÃO DE AULA E AULA EM PDF
-- 1) Módulos: cada curso pode agrupar as aulas em módulos ("Introdução", "Emergências Clínicas"...). O módulo é do CURSO
--    (product_modules); a aula continua uma só e pode estar em vários cursos, cada um com o seu módulo (module_id na ligação).
-- 2) Conclusão: o aluno marca a aula como concluída (manual) ou ela marca sozinha no fim do vídeo (auto). Vale também como
--    base da presença para o certificado (o painel lê tudo; o aluno só vê e mexe nas próprias marcações).
-- 3) Aula em PDF: a aula passa a ter um tipo (vídeo ou PDF). O arquivo do PDF reaproveita o material da aula (R2, SQL 41).
-- Migration incremental e idempotente. Execute no SQL Editor do Supabase.

-- ---------------------------------------------------------------- módulos
create table if not exists public.product_modules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_modules_product_idx on public.product_modules (product_id, position);

alter table public.product_modules enable row level security;

drop policy if exists "students read modules of own courses" on public.product_modules;
create policy "students read modules of own courses"
on public.product_modules for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.user_products up
    where up.product_id = product_modules.product_id
      and up.user_id = auth.uid()
      and up.access_status = 'active'
  )
);

drop policy if exists "admin modules full" on public.product_modules;
create policy "admin modules full"
on public.product_modules for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.product_modules to authenticated;
grant insert, update, delete on public.product_modules to authenticated;

-- Em qual módulo a aula fica, em cada curso. Apagar o módulo só solta as aulas (ficam sem módulo).
alter table public.product_lesson_links
  add column if not exists module_id uuid references public.product_modules(id) on delete set null;

-- ---------------------------------------------------------------- tipo da aula (vídeo ou PDF)
alter table public.product_lessons
  add column if not exists content_type text not null default 'video';

alter table public.product_lessons drop constraint if exists product_lessons_content_type_check;
alter table public.product_lessons
  add constraint product_lessons_content_type_check check (content_type in ('video', 'pdf'));

-- Aula em PDF não tem vídeo: a regra "precisa de link ou upload" passa a valer só para aulas em vídeo.
alter table public.product_lessons drop constraint if exists product_lessons_video_source_check;
alter table public.product_lessons
  add constraint product_lessons_video_source_check
  check (
    content_type = 'pdf'
    or (video_provider = 'youtube' and video_url is not null and btrim(video_url) <> '')
    or (video_provider = 'mux' and mux_upload_id is not null)
  );

-- ---------------------------------------------------------------- conclusão de aula
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.product_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'auto')),
  primary key (user_id, lesson_id)
);

create index if not exists lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

alter table public.lesson_progress enable row level security;

drop policy if exists "read own progress" on public.lesson_progress;
create policy "read own progress"
on public.lesson_progress for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Só marca aula que o aluno consegue ver (o exists passa pela regra de acesso da própria tabela de aulas).
drop policy if exists "mark own progress" on public.lesson_progress;
create policy "mark own progress"
on public.lesson_progress for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.product_lessons l where l.id = lesson_progress.lesson_id)
);

drop policy if exists "unmark own progress" on public.lesson_progress;
create policy "unmark own progress"
on public.lesson_progress for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "admin progress full" on public.lesson_progress;
create policy "admin progress full"
on public.lesson_progress for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, delete on public.lesson_progress to authenticated;
