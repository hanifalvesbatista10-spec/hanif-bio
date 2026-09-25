-- HANIF ALVES — PROVAS, SIMULADOS E ATIVIDADES (v2)
-- Rode no Supabase SQL Editor (Run). Pode rodar mais de uma vez sem problema.
--
-- O que muda:
--  * GABARITO PRIVADO: a resposta certa e o comentário de cada questão saem da tabela pública e vão para
--    public.form_block_keys (só o painel lê). Antes, qualquer visitante conseguia ler o gabarito pela API.
--  * Provas só para alunos logados (por produto, se quiser), com tentativas, cronômetro e nota mínima.
--  * Correção automática mais completa (várias corretas com nota parcial, numérica com tolerância, variações
--    aceitas, questão anulada) e correção manual (discursiva e envio de arquivo).
--  * Nota e comentários liberados na hora, quando o instrutor liberar ou em uma data.
--  * Funções: iniciar/enviar tentativa, ver meu resultado, listar atividades do aluno, recalcular, liberar, duplicar.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Formulários: novas configurações
-- ---------------------------------------------------------------------------
alter table public.forms
  add column if not exists audience text not null default 'public',
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists max_attempts integer,
  add column if not exists time_limit_minutes integer,
  add column if not exists pass_score numeric(5,2),
  add column if not exists release_mode text not null default 'immediate',
  add column if not exists release_at timestamptz,
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists shuffle_options boolean not null default false;

alter table public.forms drop constraint if exists forms_audience_check;
alter table public.forms add constraint forms_audience_check check (audience in ('public','students'));
alter table public.forms drop constraint if exists forms_release_mode_check;
alter table public.forms add constraint forms_release_mode_check check (release_mode in ('immediate','manual','date'));
alter table public.forms drop constraint if exists forms_max_attempts_check;
alter table public.forms add constraint forms_max_attempts_check check (max_attempts is null or max_attempts >= 1);
alter table public.forms drop constraint if exists forms_time_limit_check;
alter table public.forms add constraint forms_time_limit_check check (time_limit_minutes is null or time_limit_minutes >= 1);
alter table public.forms drop constraint if exists forms_pass_score_check;
alter table public.forms add constraint forms_pass_score_check check (pass_score is null or (pass_score >= 0 and pass_score <= 100));
alter table public.forms drop constraint if exists forms_type_check;
alter table public.forms add constraint forms_type_check
  check (type in ('survey','exam','mock','activity','task','information'));

create index if not exists idx_forms_audience on public.forms(audience, status);

-- ---------------------------------------------------------------------------
-- 2) Blocos (perguntas): novos tipos e tema
-- ---------------------------------------------------------------------------
alter table public.form_blocks add column if not exists topic text;

alter table public.form_blocks drop constraint if exists form_blocks_type_check;
alter table public.form_blocks add constraint form_blocks_type_check check (type in (
  'heading','text','image',
  'short_text','long_text','choice','multi_choice',
  'true_false','yes_no','scale','number','file'
));

-- ---------------------------------------------------------------------------
-- 3) Gabarito e comentários (PRIVADO: só o painel lê)
-- ---------------------------------------------------------------------------
create table if not exists public.form_block_keys (
  block_id uuid primary key references public.form_blocks(id) on delete cascade,
  correct jsonb,                                 -- texto, lista de textos aceitos ou {número}
  tolerance numeric(12,4),                       -- numérica: diferença aceita
  partial_credit boolean not null default false, -- várias corretas: nota proporcional
  annulled boolean not null default false,       -- questão anulada: todos ganham os pontos
  feedback text,                                 -- comentário da questão (aparece depois da liberação)
  feedback_image_url text
);

alter table public.form_block_keys enable row level security;
drop policy if exists "admin manage form block keys" on public.form_block_keys;
create policy "admin manage form block keys"
on public.form_block_keys for all to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.form_block_keys from anon;
grant all on public.form_block_keys to authenticated;

-- leva os gabaritos antigos para a tabela privada e apaga da tabela pública
insert into public.form_block_keys (block_id, correct)
select id, to_jsonb(trim(correct_answer))
from public.form_blocks
where correct_answer is not null and trim(correct_answer) <> ''
on conflict (block_id) do nothing;

update public.form_blocks set correct_answer = null where correct_answer is not null;

-- ---------------------------------------------------------------------------
-- 4) Envios e respostas
-- ---------------------------------------------------------------------------
alter table public.form_submissions
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists attempt_number integer not null default 1,
  add column if not exists status text not null default 'submitted',
  add column if not exists pending_manual boolean not null default false,
  add column if not exists passed boolean,
  add column if not exists results_released_at timestamptz,
  add column if not exists graded_at timestamptz,
  add column if not exists deadline_at timestamptz,
  add column if not exists instructor_feedback text;

alter table public.form_submissions drop constraint if exists form_submissions_status_check;
alter table public.form_submissions add constraint form_submissions_status_check
  check (status in ('in_progress','submitted','graded'));

-- respostas que já existiam contam como corrigidas e liberadas
update public.form_submissions
set status = 'graded', graded_at = submitted_at, results_released_at = submitted_at
where status = 'submitted' and pending_manual = false and graded_at is null;

create index if not exists idx_form_submissions_user on public.form_submissions(user_id, form_id);
create unique index if not exists uq_form_submissions_in_progress
  on public.form_submissions(form_id, user_id) where status = 'in_progress';

alter table public.form_answers
  add column if not exists needs_review boolean not null default false,
  add column if not exists feedback text,
  add column if not exists graded_at timestamptz;

-- ---------------------------------------------------------------------------
-- 5) Segurança das perguntas
--    Formulário público: qualquer pessoa lê as perguntas.
--    Prova de alunos: só quem está com uma tentativa em andamento (ou o admin) lê as perguntas.
-- ---------------------------------------------------------------------------
create or replace function public.form_blocks_readable(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.forms f
      where f.id = p_form_id
        and f.status = 'published'
        and f.audience = 'public'
        and (f.starts_at is null or f.starts_at <= now())
        and (f.ends_at is null or f.ends_at >= now())
    )
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.form_submissions s
        where s.form_id = p_form_id and s.user_id = auth.uid() and s.status = 'in_progress'
      )
    );
$$;
grant execute on function public.form_blocks_readable(uuid) to anon, authenticated;

drop policy if exists "public read blocks of published forms" on public.form_blocks;
drop policy if exists "read form blocks" on public.form_blocks;
create policy "read form blocks"
on public.form_blocks for select
to anon, authenticated
using (public.form_blocks_readable(form_id));

-- envios de arquivo (tarefas): bucket privado
insert into storage.buckets (id, name, public)
values ('form-uploads', 'form-uploads', false)
on conflict (id) do update set public = false;

drop policy if exists "students upload form files" on storage.objects;
create policy "students upload form files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'form-uploads'
  and name like 'forms/%/' || auth.uid()::text || '/%'
);

drop policy if exists "read form files" on storage.objects;
create policy "read form files"
on storage.objects for select to authenticated
using (
  bucket_id = 'form-uploads'
  and (public.is_admin() or name like 'forms/%/' || auth.uid()::text || '/%')
);

-- ---------------------------------------------------------------------------
-- 6) Correção automática de uma resposta
-- ---------------------------------------------------------------------------
create or replace function public.form_norm(p text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(
    translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '\s+', ' ', 'g')));
$$;

create or replace function public._form_grade_one(
  p_type text,
  p_points numeric,
  p_correct jsonb,
  p_tolerance numeric,
  p_partial boolean,
  p_annulled boolean,
  p_answer jsonb,
  out o_correct boolean,
  out o_points numeric,
  out o_review boolean
)
language plpgsql
as $$
declare
  v_pts numeric := coalesce(p_points, 0);
  v_given text;
  v_accepted text[];
  v_given_arr text[];
  v_right int;
  v_wrong int;
  v_total int;
  v_num numeric;
  v_target numeric;
  v_empty boolean;
begin
  o_correct := null;
  o_points := 0;
  o_review := false;

  if p_type in ('heading', 'text', 'image', 'scale') then
    return;
  end if;

  v_empty := p_answer is null
    or jsonb_typeof(p_answer) = 'null'
    or (jsonb_typeof(p_answer) = 'string' and trim(p_answer #>> '{}') = '')
    or (jsonb_typeof(p_answer) = 'array' and jsonb_array_length(p_answer) = 0);

  if p_annulled and v_pts > 0 then
    o_correct := true;
    o_points := v_pts;
    return;
  end if;

  -- correção manual: discursiva e envio de arquivo
  if p_type in ('long_text', 'file') then
    if v_pts > 0 and not v_empty then
      o_review := true;
    end if;
    return;
  end if;

  -- sem gabarito: a pergunta só coleta a resposta
  if p_correct is null or jsonb_typeof(p_correct) = 'null' then
    return;
  end if;

  if v_empty then
    o_correct := false;
    return;
  end if;

  if p_type in ('choice', 'true_false', 'yes_no', 'short_text') then
    if jsonb_typeof(p_correct) = 'array' then
      select coalesce(array_agg(public.form_norm(e)), array[]::text[]) into v_accepted
      from jsonb_array_elements_text(p_correct) e;
    else
      v_accepted := array[public.form_norm(p_correct #>> '{}')];
    end if;
    v_given := public.form_norm(p_answer #>> '{}');
    o_correct := v_given <> '' and v_given = any (v_accepted);
    if o_correct then o_points := v_pts; end if;

  elsif p_type = 'multi_choice' then
    if jsonb_typeof(p_correct) = 'array' then
      select coalesce(array_agg(public.form_norm(e)), array[]::text[]) into v_accepted
      from jsonb_array_elements_text(p_correct) e;
    else
      v_accepted := array[public.form_norm(p_correct #>> '{}')];
    end if;
    if jsonb_typeof(p_answer) = 'array' then
      select coalesce(array_agg(public.form_norm(e)), array[]::text[]) into v_given_arr
      from jsonb_array_elements_text(p_answer) e;
    else
      v_given_arr := array[public.form_norm(p_answer #>> '{}')];
    end if;
    v_total := coalesce(array_length(v_accepted, 1), 0);
    select count(*) filter (where g = any (v_accepted)),
           count(*) filter (where not (g = any (v_accepted)))
      into v_right, v_wrong
    from unnest(v_given_arr) g;
    o_correct := v_total > 0 and v_right = v_total and v_wrong = 0;
    if o_correct then
      o_points := v_pts;
    elsif p_partial and v_total > 0 then
      o_points := round(v_pts * greatest(0, v_right - v_wrong)::numeric / v_total, 2);
    end if;

  elsif p_type = 'number' then
    v_given := replace(trim(p_answer #>> '{}'), ',', '.');
    if v_given !~ '^-?[0-9]+(\.[0-9]+)?$' then
      o_correct := false;
      return;
    end if;
    v_num := v_given::numeric;
    if jsonb_typeof(p_correct) = 'number' then
      v_target := (p_correct #>> '{}')::numeric;
    else
      v_given := replace(trim(p_correct #>> '{}'), ',', '.');
      if v_given !~ '^-?[0-9]+(\.[0-9]+)?$' then return; end if;
      v_target := v_given::numeric;
    end if;
    o_correct := abs(v_num - v_target) <= coalesce(p_tolerance, 0);
    if o_correct then o_points := v_pts; end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Recalcular a nota de um envio
-- ---------------------------------------------------------------------------
create or replace function public._form_recalc(p_submission uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.form_submissions;
  v_form public.forms;
  v_score numeric;
  v_max numeric;
  v_pending boolean;
begin
  select * into v_sub from public.form_submissions where id = p_submission;
  if not found then return; end if;
  select * into v_form from public.forms where id = v_sub.form_id;

  select coalesce(sum(points), 0) into v_max
  from public.form_blocks
  where form_id = v_sub.form_id and points > 0 and type not in ('heading', 'text', 'image', 'scale');

  select coalesce(sum(points_awarded), 0), coalesce(bool_or(needs_review), false)
    into v_score, v_pending
  from public.form_answers where submission_id = p_submission;

  update public.form_submissions set
    score = v_score,
    max_score = v_max,
    pending_manual = v_pending,
    status = case when status = 'in_progress' then status when v_pending then 'submitted' else 'graded' end,
    graded_at = case when status = 'in_progress' or v_pending then null else coalesce(graded_at, now()) end,
    passed = case
      when status <> 'in_progress' and not v_pending and v_form.pass_score is not null and v_max > 0
        then (v_score / v_max * 100) >= v_form.pass_score
      else null end,
    results_released_at = case
      when status <> 'in_progress' and not v_pending and results_released_at is null and v_form.release_mode = 'immediate'
        then now()
      else results_released_at end
  where id = p_submission;
end;
$$;

-- corrige as respostas de um envio segundo o gabarito atual
create or replace function public._form_apply_answers(p_submission uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.form_submissions;
  b record;
  g record;
  v_ans jsonb;
  v_path text;
begin
  select * into v_sub from public.form_submissions where id = p_submission;
  delete from public.form_answers where submission_id = p_submission;

  for b in
    select fb.id, fb.type, fb.points, k.correct, k.tolerance, k.partial_credit, k.annulled
    from public.form_blocks fb
    left join public.form_block_keys k on k.block_id = fb.id
    where fb.form_id = v_sub.form_id and fb.type not in ('heading', 'text', 'image')
    order by fb.position
  loop
    v_ans := null;
    select e -> 'value' into v_ans
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) e
    where e ->> 'block_id' = b.id::text
    limit 1;
    if v_ans is not null and jsonb_typeof(v_ans) = 'null' then v_ans := null; end if;

    if b.type = 'file' and v_ans is not null then
      v_path := v_ans ->> 'path';
      if v_path is null or v_sub.user_id is null
         or v_path not like 'forms/' || v_sub.form_id::text || '/' || v_sub.user_id::text || '/%' then
        v_ans := null;
      end if;
    end if;

    select * into g from public._form_grade_one(b.type, b.points, b.correct, b.tolerance, b.partial_credit,
                                                 coalesce(b.annulled, false), v_ans);
    insert into public.form_answers (submission_id, block_id, answer, is_correct, points_awarded, needs_review)
    values (p_submission, b.id, v_ans, g.o_correct, g.o_points, g.o_review);
  end loop;

  perform public._form_recalc(p_submission);
end;
$$;

create or replace function public._form_is_released(p_sub public.form_submissions, p_form public.forms)
returns boolean
language sql
stable
as $$
  select p_sub.status <> 'in_progress' and (
    (p_sub.results_released_at is not null and p_sub.results_released_at <= now())
    or (p_form.release_mode = 'date' and p_form.release_at is not null and now() >= p_form.release_at and not p_sub.pending_manual)
  );
$$;

create or replace function public._form_submit_summary(p_submission uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.form_submissions;
  v_form public.forms;
  v_released boolean;
begin
  select * into v_sub from public.form_submissions where id = p_submission;
  select * into v_form from public.forms where id = v_sub.form_id;
  v_released := public._form_is_released(v_sub, v_form);
  return jsonb_build_object(
    'submission_id', v_sub.id,
    'status', v_sub.status,
    'pending_manual', v_sub.pending_manual,
    'released', v_released,
    'score', case when v_released then v_sub.score end,
    'max_score', case when v_released then v_sub.max_score end,
    'passed', case when v_released then v_sub.passed end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Formulário PÚBLICO (mesmo nome de antes; agora corrige pelo gabarito privado)
-- ---------------------------------------------------------------------------
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
  v_sub public.form_submissions;
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
  if v_form.audience <> 'public' then
    raise exception 'Este formulário é só para alunos. Entre na sua conta para responder.';
  end if;

  insert into public.form_submissions (
    form_id, respondent_name, respondent_email, respondent_data, started_at, status
  ) values (
    p_form_id,
    nullif(trim(coalesce(p_respondent ->> 'name', '')), ''),
    nullif(trim(coalesce(p_respondent ->> 'email', '')), ''),
    coalesce(p_respondent, '{}'::jsonb),
    case when coalesce(p_respondent ->> 'started_at', '') <> '' then (p_respondent ->> 'started_at')::timestamptz else null end,
    'submitted'
  ) returning id into v_submission;

  perform public._form_apply_answers(v_submission, p_answers);

  select * into v_sub from public.form_submissions where id = v_submission;
  return jsonb_build_object(
    'submission_id', v_sub.id,
    'score', v_sub.score,
    'max_score', v_sub.max_score,
    'pending_manual', v_sub.pending_manual
  );
end;
$$;

revoke all on function public.submit_public_form(uuid, jsonb, jsonb) from public;
grant execute on function public.submit_public_form(uuid, jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9) Prova de ALUNOS: iniciar e enviar tentativa
-- ---------------------------------------------------------------------------
create or replace function public.form_start_attempt(p_form_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_form public.forms;
  v_sub public.form_submissions;
  v_used integer;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para responder.';
  end if;

  select * into v_form
  from public.forms
  where id = p_form_id
    and status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now());
  if not found then
    raise exception 'Esta atividade não está disponível agora.';
  end if;
  if v_form.audience <> 'students' then
    raise exception 'Este formulário é público: responda pelo link.';
  end if;

  select * into v_profile from public.profiles where id = v_uid and account_status = 'active';
  if not found then
    raise exception 'Conta sem acesso.';
  end if;
  if v_form.product_id is not null and not exists (
    select 1 from public.user_products up
    where up.user_id = v_uid and up.product_id = v_form.product_id and up.access_status = 'active'
  ) then
    raise exception 'Esta atividade não está liberada para a sua conta.';
  end if;

  -- tentativa em andamento: retoma (o cronômetro continua de onde estava)
  select * into v_sub from public.form_submissions
  where form_id = p_form_id and user_id = v_uid and status = 'in_progress'
  for update;
  if found then
    if v_sub.deadline_at is not null and now() > v_sub.deadline_at + interval '60 seconds' then
      update public.form_submissions set status = 'submitted', submitted_at = now() where id = v_sub.id;
      perform public._form_apply_answers(v_sub.id, '[]'::jsonb);
    else
      return jsonb_build_object(
        'submission_id', v_sub.id, 'started_at', v_sub.started_at, 'deadline_at', v_sub.deadline_at,
        'attempt_number', v_sub.attempt_number, 'resumed', true
      );
    end if;
  end if;

  select count(*) into v_used from public.form_submissions
  where form_id = p_form_id and user_id = v_uid and status <> 'in_progress';
  if v_form.max_attempts is not null and v_used >= v_form.max_attempts then
    raise exception 'Você já usou todas as tentativas desta atividade.';
  end if;

  insert into public.form_submissions (
    form_id, user_id, respondent_name, respondent_email, status, attempt_number, started_at, deadline_at
  ) values (
    p_form_id, v_uid, v_profile.full_name, v_profile.email, 'in_progress', v_used + 1, now(),
    case when v_form.time_limit_minutes is not null then now() + make_interval(mins => v_form.time_limit_minutes) end
  ) returning * into v_sub;

  return jsonb_build_object(
    'submission_id', v_sub.id, 'started_at', v_sub.started_at, 'deadline_at', v_sub.deadline_at,
    'attempt_number', v_sub.attempt_number, 'resumed', false
  );
end;
$$;

create or replace function public.form_submit(p_form_id uuid, p_submission_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.form_submissions;
  v_expired boolean := false;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para responder.';
  end if;

  select * into v_sub from public.form_submissions
  where id = p_submission_id and form_id = p_form_id and user_id = v_uid and status = 'in_progress'
  for update;
  if not found then
    raise exception 'Esta tentativa não foi encontrada ou já foi enviada.';
  end if;

  if v_sub.deadline_at is not null and now() > v_sub.deadline_at + interval '60 seconds' then
    v_expired := true;
  end if;

  update public.form_submissions set status = 'submitted', submitted_at = now() where id = v_sub.id;
  perform public._form_apply_answers(v_sub.id, case when v_expired then '[]'::jsonb else p_answers end);

  return public._form_submit_summary(v_sub.id) || jsonb_build_object('expired', v_expired);
end;
$$;

revoke all on function public.form_start_attempt(uuid) from public;
revoke all on function public.form_submit(uuid, uuid, jsonb) from public;
grant execute on function public.form_start_attempt(uuid) to authenticated;
grant execute on function public.form_submit(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) O aluno vê o próprio resultado (só depois da liberação)
-- ---------------------------------------------------------------------------
create or replace function public.form_get_my_result(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.form_submissions;
  v_form public.forms;
  v_released boolean;
  v_used integer;
  v_show_key boolean;
  v_base jsonb;
  v_items jsonb;
begin
  select * into v_sub from public.form_submissions where id = p_submission_id;
  if not found or v_sub.status = 'in_progress' then
    raise exception 'Resultado não encontrado.';
  end if;
  if v_sub.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Resultado não encontrado.';
  end if;
  select * into v_form from public.forms where id = v_sub.form_id;
  v_released := public._form_is_released(v_sub, v_form);

  v_base := jsonb_build_object(
    'submission_id', v_sub.id,
    'status', v_sub.status,
    'attempt_number', v_sub.attempt_number,
    'submitted_at', v_sub.submitted_at,
    'pending_manual', v_sub.pending_manual,
    'released', v_released,
    'release_mode', v_form.release_mode,
    'release_at', v_form.release_at,
    'form', jsonb_build_object(
      'id', v_form.id, 'slug', v_form.slug, 'title', v_form.title, 'type', v_form.type,
      'pass_score', v_form.pass_score, 'max_attempts', v_form.max_attempts
    )
  );
  if not v_released then
    return v_base;
  end if;

  select count(*) into v_used from public.form_submissions
  where form_id = v_form.id and user_id = v_sub.user_id and status <> 'in_progress';
  v_show_key := coalesce((v_form.settings ->> 'show_key')::boolean, true)
    and not (
      coalesce((v_form.settings ->> 'key_after_last_attempt')::boolean, false)
      and (v_form.max_attempts is null or v_used < v_form.max_attempts)
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'block_id', b.id,
    'position', b.position,
    'type', b.type,
    'title', b.title,
    'description', b.description,
    'image_url', b.image_url,
    'options', b.options,
    'points', b.points,
    'is_question', b.type not in ('heading', 'text', 'image'),
    'answer', a.answer,
    'is_correct', a.is_correct,
    'points_awarded', a.points_awarded,
    'needs_review', coalesce(a.needs_review, false),
    'instructor_feedback', a.feedback,
    'annulled', coalesce(k.annulled, false),
    'correct', case when v_show_key then k.correct end,
    'explanation', case when v_show_key then k.feedback end,
    'explanation_image_url', case when v_show_key then k.feedback_image_url end
  ) order by b.position), '[]'::jsonb)
  into v_items
  from public.form_blocks b
  left join public.form_answers a on a.block_id = b.id and a.submission_id = v_sub.id
  left join public.form_block_keys k on k.block_id = b.id
  where b.form_id = v_form.id;

  return v_base || jsonb_build_object(
    'score', v_sub.score,
    'max_score', v_sub.max_score,
    'passed', v_sub.passed,
    'instructor_feedback', v_sub.instructor_feedback,
    'key_shown', v_show_key,
    'attempts_used', v_used,
    'items', v_items
  );
end;
$$;

revoke all on function public.form_get_my_result(uuid) from public;
grant execute on function public.form_get_my_result(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11) Lista de atividades do aluno (aba "Atividades")
-- ---------------------------------------------------------------------------
create or replace function public.form_list_for_student()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  f public.forms;
  v_used integer;
  v_prog public.form_submissions;
  v_last public.form_submissions;
  v_open boolean;
  v_released boolean;
  v_questions integer;
  v_points numeric;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.';
  end if;

  for f in
    select * from public.forms x
    where x.audience = 'students'
      and x.status = 'published'
      and (
        x.product_id is null
        or exists (
          select 1 from public.user_products up
          where up.user_id = v_uid and up.product_id = x.product_id and up.access_status = 'active'
        )
      )
    order by x.created_at desc
  loop
    select count(*) into v_used from public.form_submissions
    where form_id = f.id and user_id = v_uid and status <> 'in_progress';

    v_open := (f.starts_at is null or f.starts_at <= now()) and (f.ends_at is null or f.ends_at >= now());
    if not v_open and v_used = 0 then
      continue;
    end if;

    select * into v_prog from public.form_submissions
    where form_id = f.id and user_id = v_uid and status = 'in_progress';
    if found and v_prog.deadline_at is not null and now() > v_prog.deadline_at + interval '60 seconds' then
      v_prog := null;
    end if;

    v_last := null;
    select * into v_last from public.form_submissions
    where form_id = f.id and user_id = v_uid and status <> 'in_progress'
    order by submitted_at desc limit 1;

    v_released := false;
    if v_last.id is not null then
      v_released := public._form_is_released(v_last, f);
    end if;

    select count(*), coalesce(sum(points) filter (where points > 0), 0) into v_questions, v_points
    from public.form_blocks where form_id = f.id and type not in ('heading', 'text', 'image');

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', f.id, 'slug', f.slug, 'title', f.title, 'description', f.description, 'type', f.type,
      'starts_at', f.starts_at, 'ends_at', f.ends_at,
      'time_limit_minutes', f.time_limit_minutes, 'max_attempts', f.max_attempts, 'pass_score', f.pass_score,
      'release_mode', f.release_mode, 'release_at', f.release_at,
      'question_count', v_questions, 'total_points', v_points,
      'attempts_used', v_used,
      'in_progress', v_prog.id is not null,
      'deadline_at', v_prog.deadline_at,
      'can_start', v_open and (f.max_attempts is null or v_used < f.max_attempts),
      'last', case when v_last.id is null then null else jsonb_build_object(
        'submission_id', v_last.id,
        'status', v_last.status,
        'submitted_at', v_last.submitted_at,
        'pending_manual', v_last.pending_manual,
        'released', v_released,
        'score', case when v_released then v_last.score end,
        'max_score', case when v_released then v_last.max_score end,
        'passed', case when v_released then v_last.passed end
      ) end
    ));
  end loop;

  return v_out;
end;
$$;

revoke all on function public.form_list_for_student() from public;
grant execute on function public.form_list_for_student() to authenticated;

-- ---------------------------------------------------------------------------
-- 12) Ferramentas do instrutor
-- ---------------------------------------------------------------------------
-- corrige a resposta discursiva / arquivo (ou ajusta uma nota) e recalcula o envio
create or replace function public.form_grade_answer(p_answer_id uuid, p_points numeric, p_feedback text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ans public.form_answers;
  v_block public.form_blocks;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  select * into v_ans from public.form_answers where id = p_answer_id;
  if not found then
    raise exception 'Resposta não encontrada.';
  end if;
  select * into v_block from public.form_blocks where id = v_ans.block_id;
  if p_points is null or p_points < 0 or p_points > coalesce(v_block.points, 0) then
    raise exception 'A nota precisa estar entre 0 e %.', coalesce(v_block.points, 0);
  end if;

  update public.form_answers set
    points_awarded = p_points,
    is_correct = p_points >= coalesce(v_block.points, 0),
    needs_review = false,
    feedback = nullif(trim(coalesce(p_feedback, '')), ''),
    graded_at = now()
  where id = p_answer_id;

  perform public._form_recalc(v_ans.submission_id);
  return public._form_submit_summary(v_ans.submission_id);
end;
$$;

-- recalcula TODAS as notas do formulário com o gabarito atual (use depois de corrigir um gabarito ou anular questão)
create or replace function public.form_regrade(p_form_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  g record;
  v_sub uuid;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;

  for a in
    select fa.id, fa.answer, fa.needs_review, fa.points_awarded, fa.graded_at,
           fb.type, fb.points, k.correct, k.tolerance, k.partial_credit, coalesce(k.annulled, false) as annulled
    from public.form_answers fa
    join public.form_submissions s on s.id = fa.submission_id and s.form_id = p_form_id and s.status <> 'in_progress'
    join public.form_blocks fb on fb.id = fa.block_id
    left join public.form_block_keys k on k.block_id = fb.id
  loop
    if a.type in ('long_text', 'file') and not a.annulled and a.graded_at is not null then
      continue; -- nota manual já dada: mantém
    end if;
    select * into g from public._form_grade_one(a.type, a.points, a.correct, a.tolerance, a.partial_credit, a.annulled, a.answer);
    update public.form_answers
    set is_correct = g.o_correct, points_awarded = g.o_points, needs_review = g.o_review
    where id = a.id;
  end loop;

  for v_sub in
    select id from public.form_submissions where form_id = p_form_id and status <> 'in_progress'
  loop
    perform public._form_recalc(v_sub);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- libera nota e comentários (p_ids nulo = todos os corrigidos ainda não liberados)
create or replace function public.form_release_results(p_form_id uuid, p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  update public.form_submissions
  set results_released_at = now()
  where form_id = p_form_id
    and status = 'graded'
    and results_released_at is null
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.form_hide_results(p_form_id uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  update public.form_submissions
  set results_released_at = null
  where form_id = p_form_id and id = any (p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- duplica uma prova (perguntas, gabarito e comentários), como rascunho
create or replace function public.form_duplicate(p_form_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.forms;
  v_new uuid;
  v_slug text;
  v_base text;
  v_n integer := 1;
  b record;
  v_block uuid;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  select * into v_form from public.forms where id = p_form_id;
  if not found then
    raise exception 'Formulário não encontrado.';
  end if;

  v_base := v_form.slug || '-copia';
  v_slug := v_base;
  while exists (select 1 from public.forms where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.forms (
    title, slug, description, type, status, settings, audience, product_id, max_attempts, time_limit_minutes,
    pass_score, release_mode, release_at, shuffle_questions, shuffle_options, created_by
  ) values (
    v_form.title || ' (cópia)', v_slug, v_form.description, v_form.type, 'draft', v_form.settings, v_form.audience,
    v_form.product_id, v_form.max_attempts, v_form.time_limit_minutes, v_form.pass_score, v_form.release_mode,
    v_form.release_at, v_form.shuffle_questions, v_form.shuffle_options, auth.uid()
  ) returning id into v_new;

  for b in select * from public.form_blocks where form_id = p_form_id order by position loop
    insert into public.form_blocks (form_id, type, title, description, image_url, options, required, points, position, topic)
    values (v_new, b.type, b.title, b.description, b.image_url, b.options, b.required, b.points, b.position, b.topic)
    returning id into v_block;
    insert into public.form_block_keys (block_id, correct, tolerance, partial_credit, annulled, feedback, feedback_image_url)
    select v_block, correct, tolerance, partial_credit, annulled, feedback, feedback_image_url
    from public.form_block_keys where block_id = b.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.form_grade_answer(uuid, numeric, text) from public;
revoke all on function public.form_regrade(uuid) from public;
revoke all on function public.form_release_results(uuid, uuid[]) from public;
revoke all on function public.form_hide_results(uuid, uuid[]) from public;
revoke all on function public.form_duplicate(uuid) from public;
grant execute on function public.form_grade_answer(uuid, numeric, text) to authenticated;
grant execute on function public.form_regrade(uuid) to authenticated;
grant execute on function public.form_release_results(uuid, uuid[]) to authenticated;
grant execute on function public.form_hide_results(uuid, uuid[]) to authenticated;
grant execute on function public.form_duplicate(uuid) to authenticated;

-- funções internas: ninguém chama pelo navegador
revoke all on function public._form_recalc(uuid) from public;
revoke all on function public._form_apply_answers(uuid, jsonb) from public;
revoke all on function public._form_submit_summary(uuid) from public;
revoke all on function public._form_grade_one(text, numeric, jsonb, numeric, boolean, boolean, jsonb) from public;
