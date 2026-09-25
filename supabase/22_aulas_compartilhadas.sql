-- AULAS COMPARTILHADAS ENTRE CURSOS
-- Antes: cada aula pertencia a um único produto (product_lessons.product_id).
-- Agora: uma aula pode aparecer em vários cursos, com a ordem própria em cada um.
-- Editar a aula, trocar o vídeo ou tirá-la do ar vale para todos os cursos onde ela está.
-- Comentários ficam na aula: os alunos de todos os cursos que a têm veem os mesmos comentários.
--
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.
-- Não apaga nada: as aulas atuais continuam no curso onde estão.

-- 1) Tabela de ligação aula <-> curso
create table if not exists public.product_lesson_links (
  lesson_id uuid not null references public.product_lessons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (lesson_id, product_id)
);

create index if not exists product_lesson_links_product_idx
  on public.product_lesson_links(product_id, position);

-- 2) Leva as aulas que já existem para a nova tabela (cada uma no curso onde já estava)
insert into public.product_lesson_links (lesson_id, product_id, position)
select id, product_id, position
from public.product_lessons
where product_id is not null
on conflict do nothing;

-- 3) product_lessons.product_id vira só o "curso de origem": não é mais obrigatório,
--    e apagar o curso de origem não apaga a aula se ela estiver em outros cursos.
alter table public.product_lessons alter column product_id drop not null;
alter table public.product_lessons drop constraint if exists product_lessons_product_id_fkey;
alter table public.product_lessons
  add constraint product_lessons_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

-- 4) Aula criada com um produto de origem entra sozinha na ligação (ajuda quem ainda usa o modo antigo)
create or replace function public.product_lessons_autolink()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    insert into public.product_lesson_links (lesson_id, product_id, position)
    values (new.id, new.product_id, coalesce(new.position, 0))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists product_lessons_autolink on public.product_lessons;
create trigger product_lessons_autolink
after insert on public.product_lessons
for each row execute function public.product_lessons_autolink();

-- 5) Permissões
alter table public.product_lesson_links enable row level security;

drop policy if exists "read lesson links" on public.product_lesson_links;
create policy "read lesson links"
on public.product_lesson_links for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.user_products up
    where up.product_id = product_lesson_links.product_id
      and up.user_id = auth.uid()
      and up.access_status = 'active'
  )
);

drop policy if exists "admin lesson links full" on public.product_lesson_links;
create policy "admin lesson links full"
on public.product_lesson_links for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.product_lesson_links to authenticated;
grant insert, update, delete on public.product_lesson_links to authenticated;

-- aluno lê a aula publicada se tiver acesso ativo a QUALQUER curso onde ela está
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
      where l.lesson_id = product_lessons.id
        and up.user_id = auth.uid()
        and up.access_status = 'active'
    )
  )
);

-- comentários e vídeo protegido (Mux) usam esta função e a leitura da aula: agora valem para aulas compartilhadas
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
    where l.id = target_lesson
      and l.status = 'published'
      and up.user_id = auth.uid()
      and up.access_status = 'active'
  );
$$;

grant execute on function public.can_access_lesson(uuid) to authenticated;
