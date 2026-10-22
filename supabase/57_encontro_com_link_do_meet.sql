-- HANIF ALVES — ENCONTRO COM LINK DO GOOGLE MEET (E ENCERRAMENTO PELO PAINEL)
-- O encontro pode ter um link externo (Google Meet): em vez de abrir a sala do Daily dentro do site, o aluno entra pelo link,
-- numa nova aba. A live aparece como "ao vivo" do horário marcado até o fim da duração e encerra sozinha; o painel pode
-- encerrar antes (ended_at) ou prolongar (aumentando a duração). Também ajusta a presença (SQL 56): a janela de marcar
-- presença passa a terminar 1 hora depois do ENCERRAMENTO real, quando houve encerramento antecipado.
-- Migration incremental e idempotente. Execute no SQL Editor do Supabase.

alter table public.live_meetings
  add column if not exists meet_url text,
  add column if not exists ended_at timestamptz;

alter table public.live_meetings drop constraint if exists live_meetings_meet_url_check;
alter table public.live_meetings
  add constraint live_meetings_meet_url_check check (meet_url is null or meet_url ~* '^https://[^\s]+$');

create or replace function public.mark_meeting_attendance(p_meeting_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  meeting public.live_meetings;
  stamp timestamptz;
  finish timestamptz;
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

  finish := coalesce(meeting.ended_at, meeting.starts_at + make_interval(mins => meeting.duration_minutes));

  if now() < meeting.starts_at then
    raise exception 'O encontro ainda não começou. A presença abre no horário de início.' using errcode = 'P0001';
  end if;
  if now() > finish + interval '1 hour' then
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
