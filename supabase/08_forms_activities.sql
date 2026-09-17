-- HANIF ALVES — MÓDULO DE FORMULÁRIOS E ATIVIDADES
-- Execute no Supabase SQL Editor após o deploy desta versão.

create extension if not exists pgcrypto;

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  type text not null default 'survey' check (type in ('survey','exam','activity','task','information')),
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  settings jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_blocks (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  type text not null check (type in (
    'heading','text','image',
    'short_text','long_text','choice','multi_choice',
    'true_false','yes_no','scale'
  )),
  title text,
  description text,
  image_url text,
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  correct_answer text,
  points numeric(10,2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  respondent_name text,
  respondent_email text,
  respondent_data jsonb not null default '{}'::jsonb,
  score numeric(10,2),
  max_score numeric(10,2),
  started_at timestamptz,
  submitted_at timestamptz not null default now()
);

create table if not exists public.form_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete cascade,
  block_id uuid not null references public.form_blocks(id) on delete cascade,
  answer jsonb,
  is_correct boolean,
  points_awarded numeric(10,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_forms_status on public.forms(status);
create index if not exists idx_forms_slug on public.forms(slug);
create index if not exists idx_form_blocks_form_position on public.form_blocks(form_id, position);
create index if not exists idx_form_submissions_form on public.form_submissions(form_id, submitted_at desc);
create index if not exists idx_form_answers_submission on public.form_answers(submission_id);

create or replace function public.touch_forms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forms_updated_at on public.forms;
create trigger forms_updated_at
before update on public.forms
for each row execute function public.touch_forms_updated_at();

alter table public.forms enable row level security;
alter table public.form_blocks enable row level security;
alter table public.form_submissions enable row level security;
alter table public.form_answers enable row level security;

drop policy if exists "public read published forms" on public.forms;
create policy "public read published forms"
on public.forms for select
to anon, authenticated
using (
  status = 'published'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
  or public.is_admin()
);

drop policy if exists "admin manage forms" on public.forms;
create policy "admin manage forms"
on public.forms for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public read blocks of published forms" on public.form_blocks;
create policy "public read blocks of published forms"
on public.form_blocks for select
to anon, authenticated
using (
  exists (
    select 1
    from public.forms f
    where f.id = form_blocks.form_id
      and f.status = 'published'
      and (f.starts_at is null or f.starts_at <= now())
      and (f.ends_at is null or f.ends_at >= now())
  )
  or public.is_admin()
);

drop policy if exists "admin manage form blocks" on public.form_blocks;
create policy "admin manage form blocks"
on public.form_blocks for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin read submissions" on public.form_submissions;
create policy "admin read submissions"
on public.form_submissions for select
to authenticated
using (public.is_admin());

drop policy if exists "admin manage submissions" on public.form_submissions;
create policy "admin manage submissions"
on public.form_submissions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin read answers" on public.form_answers;
create policy "admin read answers"
on public.form_answers for select
to authenticated
using (public.is_admin());

drop policy if exists "admin manage answers" on public.form_answers;
create policy "admin manage answers"
on public.form_answers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.forms, public.form_blocks to anon, authenticated;
grant all on public.forms, public.form_blocks, public.form_submissions, public.form_answers to authenticated;

insert into storage.buckets (id, name, public)
values ('forms-media', 'forms-media', true)
on conflict (id) do update set public = true;

drop policy if exists "public read forms media" on storage.objects;
create policy "public read forms media"
on storage.objects for select
to public
using (bucket_id = 'forms-media');

drop policy if exists "admin manage forms media" on storage.objects;
create policy "admin manage forms media"
on storage.objects for all
to authenticated
using (bucket_id = 'forms-media' and public.is_admin())
with check (bucket_id = 'forms-media' and public.is_admin());

create or replace function public.submit_public_form(
  p_form_id uuid,
  p_respondent jsonb,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.forms;
  v_submission uuid;
  v_item jsonb;
  v_block public.form_blocks;
  v_answer jsonb;
  v_text text;
  v_correct boolean;
  v_points numeric(10,2);
  v_score numeric(10,2) := 0;
  v_max numeric(10,2) := 0;
begin
  select * into v_form
  from public.forms
  where id = p_form_id
    and status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now());

  if not found then
    raise exception 'Formulário indisponível.';
  end if;

  select coalesce(sum(points),0) into v_max
  from public.form_blocks
  where form_id = p_form_id
    and points > 0;

  insert into public.form_submissions (
    form_id,
    respondent_name,
    respondent_email,
    respondent_data,
    started_at,
    max_score
  ) values (
    p_form_id,
    nullif(trim(coalesce(p_respondent->>'name','')), ''),
    nullif(trim(coalesce(p_respondent->>'email','')), ''),
    coalesce(p_respondent,'{}'::jsonb),
    case when coalesce(p_respondent->>'started_at','') <> '' then (p_respondent->>'started_at')::timestamptz else null end,
    v_max
  ) returning id into v_submission;

  for v_item in select * from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb))
  loop
    select * into v_block
    from public.form_blocks
    where id = (v_item->>'block_id')::uuid
      and form_id = p_form_id;

    if not found then
      continue;
    end if;

    v_answer := v_item->'value';
    v_correct := null;
    v_points := 0;

    if v_block.correct_answer is not null and trim(v_block.correct_answer) <> '' then
      if jsonb_typeof(v_answer) = 'array' then
        v_text := lower(trim(v_answer::text));
      else
        v_text := lower(trim(both '"' from coalesce(v_answer::text,'')));
      end if;

      v_correct := v_text = lower(trim(v_block.correct_answer));
      if v_correct then
        v_points := v_block.points;
      end if;
    end if;

    v_score := v_score + coalesce(v_points,0);

    insert into public.form_answers (
      submission_id, block_id, answer, is_correct, points_awarded
    ) values (
      v_submission, v_block.id, v_answer, v_correct, v_points
    );
  end loop;

  update public.form_submissions
  set score = v_score
  where id = v_submission;

  return jsonb_build_object(
    'submission_id', v_submission,
    'score', v_score,
    'max_score', v_max
  );
end;
$$;

revoke all on function public.submit_public_form(uuid,jsonb,jsonb) from public;
grant execute on function public.submit_public_form(uuid,jsonb,jsonb) to anon, authenticated;
