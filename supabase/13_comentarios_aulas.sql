-- COMENTÁRIOS NAS AULAS DA ÁREA DE MEMBROS
-- Cria a tabela de comentários por aula. Alunos com acesso ativo ao produto
-- comentam (comentário principal); o administrador responde, oculta ou exclui.
-- Ninguém sem login enxerga nada. Execute no Supabase:
-- SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: cria só tabela, funções e políticas novas.

-- 1) Função auxiliar: o usuário logado tem acesso ativo à aula publicada?
create or replace function public.can_access_lesson(target_lesson uuid)
returns boolean stable security definer set search_path = public language sql as $$
  select exists (
    select 1
    from public.product_lessons l
    join public.user_products up on up.product_id = l.product_id
    where l.id = target_lesson
      and l.status = 'published'
      and up.user_id = auth.uid()
      and up.access_status = 'active'
  );
$$;

grant execute on function public.can_access_lesson(uuid) to authenticated;

-- 2) Tabela
create table if not exists public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.product_lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.lesson_comments(id) on delete cascade,
  author_name text not null default 'Aluno',
  author_role text not null default 'student' check (author_role in ('student', 'admin')),
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists lesson_comments_lesson_idx on public.lesson_comments(lesson_id, created_at);
create index if not exists lesson_comments_parent_idx on public.lesson_comments(parent_id);

-- 3) Preenche nome e papel a partir do perfil (o aluno não consegue forjar isso)
--    e garante que a resposta pertence à mesma aula do comentário original.
create or replace function public.lesson_comments_before_insert()
returns trigger security definer set search_path = public language plpgsql as $$
declare
  parent_lesson uuid;
begin
  select coalesce(nullif(btrim(full_name), ''), 'Aluno')
    into new.author_name
  from public.profiles where id = new.user_id;

  if new.author_name is null then
    new.author_name := 'Aluno';
  end if;

  new.author_role := case when public.is_admin() then 'admin' else 'student' end;

  if new.parent_id is not null then
    select lesson_id into parent_lesson from public.lesson_comments where id = new.parent_id;
    if parent_lesson is null or parent_lesson <> new.lesson_id then
      raise exception 'A resposta precisa pertencer à mesma aula do comentário.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lesson_comments_before_insert on public.lesson_comments;
create trigger lesson_comments_before_insert before insert on public.lesson_comments
for each row execute function public.lesson_comments_before_insert();

-- 4) RLS
alter table public.lesson_comments enable row level security;

drop policy if exists "students read visible lesson comments" on public.lesson_comments;
create policy "students read visible lesson comments"
on public.lesson_comments for select
to authenticated
using (
  public.is_admin()
  or (status = 'visible' and public.can_access_lesson(lesson_id))
);

drop policy if exists "students post lesson comments" on public.lesson_comments;
create policy "students post lesson comments"
on public.lesson_comments for insert
to authenticated
with check (
  user_id = auth.uid()
  and parent_id is null
  and public.is_active_user()
  and public.can_access_lesson(lesson_id)
);

drop policy if exists "students delete own lesson comments" on public.lesson_comments;
create policy "students delete own lesson comments"
on public.lesson_comments for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "admin lesson comments full" on public.lesson_comments;
create policy "admin lesson comments full"
on public.lesson_comments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.lesson_comments;
exception
  when duplicate_object then null;
end $$;
