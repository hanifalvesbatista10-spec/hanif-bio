-- HANIF ALVES — PRESENÇA PARA O CERTIFICADO
-- O certificado continua sendo emitido à mão pelo painel; aqui fica só o registro de quem esteve presente.
-- 1) Encontros ao vivo (sala Daily): o aluno marca "Marcar minha presença" durante o encontro. A marcação passa por uma
--    função (mark_meeting_attendance) que confere o acesso ao curso e a janela de tempo: do começo do encontro até 1 hora
--    depois do fim. O aluno não grava direto na tabela; só lê a própria presença. O painel lê e ajusta tudo.
-- 2) Aulas ao vivo (live no YouTube): a presença usa a conclusão de aula (SQL 55) com origem "live", só aceita enquanto a
--    aula está marcada como ao vivo (SQL 32). O painel pode marcar com origem "admin".
-- Migration incremental e idempotente. Execute no SQL Editor do Supabase.

-- ---------------------------------------------------------------- presença em encontros
create table if not exists public.meeting_attendance (
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.live_meetings(id) on delete cascade,
  marked_at timestamptz not null default now(),
  source text not null default 'student' check (source in ('student', 'admin')),
  primary key (user_id, meeting_id)
);

create index if not exists meeting_attendance_meeting_idx on public.meeting_attendance (meeting_id);

alter table public.meeting_attendance enable row level security;

drop policy if exists "read own attendance" on public.meeting_attendance;
create policy "read own attendance"
on public.meeting_attendance for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin attendance full" on public.meeting_attendance;
create policy "admin attendance full"
on public.meeting_attendance for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on public.meeting_attendance from anon;
grant select, insert, update, delete on public.meeting_attendance to authenticated;

-- O aluno marca por esta função (e só por ela).
create or replace function public.mark_meeting_attendance(p_meeting_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  meeting public.live_meetings;
  stamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para marcar presença.' using errcode = '28000';
  end if;

  select * into meeting from public.live_meetings where id = p_meeting_id;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0002';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.user_products up
    where up.user_id = auth.uid() and up.product_id = meeting.product_id and up.access_status = 'active'
  ) then
    raise exception 'Você não tem acesso a este encontro.' using errcode = '42501';
  end if;

  if now() < meeting.starts_at then
    raise exception 'O encontro ainda não começou. A presença abre no horário de início.' using errcode = 'P0001';
  end if;
  if now() > meeting.starts_at + make_interval(mins => meeting.duration_minutes + 60) then
    raise exception 'O prazo para marcar presença neste encontro já passou.' using errcode = 'P0001';
  end if;

  insert into public.meeting_attendance (user_id, meeting_id) values (auth.uid(), p_meeting_id)
  on conflict (user_id, meeting_id) do nothing;

  select marked_at into stamp from public.meeting_attendance where user_id = auth.uid() and meeting_id = p_meeting_id;
  return stamp;
end;
$$;

revoke all on function public.mark_meeting_attendance(uuid) from public, anon;
grant execute on function public.mark_meeting_attendance(uuid) to authenticated;

-- ---------------------------------------------------------------- presença em aula ao vivo
alter table public.lesson_progress drop constraint if exists lesson_progress_source_check;
alter table public.lesson_progress
  add constraint lesson_progress_source_check check (source in ('manual', 'auto', 'live', 'admin'));

-- "live" só vale enquanto a aula está ao vivo (o aviso dura 6 horas); "admin" só o painel grava.
create or replace function public.lesson_progress_source_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'admin' and not public.is_admin() then
    raise exception 'Origem de marcação inválida.' using errcode = '42501';
  end if;
  if new.source = 'live' and not public.is_admin() then
    if not exists (
      select 1 from public.product_lessons l
      where l.id = new.lesson_id and l.is_live and l.live_started_at > now() - interval '6 hours'
    ) then
      raise exception 'Esta aula não está ao vivo agora.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lesson_progress_source_guard on public.lesson_progress;
create trigger lesson_progress_source_guard
before insert on public.lesson_progress
for each row execute function public.lesson_progress_source_guard();
