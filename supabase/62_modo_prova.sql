-- HANIF ALVES — MODO PROVA (SAÍDAS DA TELA), TEMPO E "UMA RESPOSTA POR E-MAIL" EM PROVA PÚBLICA
-- O que faz:
--  1) form_submissions.exam_log: guarda quantas vezes a pessoa saiu da tela da prova, por quanto tempo e se a prova foi encerrada
--     por excesso de saídas. O navegador envia esses números; o banco só aceita números pequenos (nada de texto livre).
--  2) submit_public_form (prova aberta pelo link): passa a gravar o exam_log; respeita o tempo de prova (forms.time_limit_minutes):
--     envio até 2 min depois do limite entra normal, até 10 min depois entra marcado como "atrasado" (late_seconds) e depois disso é
--     recusado; e, se a prova tiver settings.one_per_email = true, recusa um segundo envio do mesmo e-mail. Provas de parceiro
--     (pré e pós-teste) NÃO são afetadas pelo "um por e-mail": lá o mesmo e-mail pode responder de novo (SQL 61).
--  3) form_log_exam: o aluno logado registra as saídas da própria tentativa (só dele, enquanto em andamento ou até 10 min após enviar).
-- Não apaga nem altera respostas existentes. Execute no SQL Editor do Supabase.

alter table public.form_submissions add column if not exists exam_log jsonb;

-- Aceita só números pequenos e uma lista curta de [segundos desde o início, segundos fora].
create or replace function public._form_exam_log_clean(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v_exits integer;
  v_away integer;
  v_events jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return null;
  end if;
  v_exits := case when (p ->> 'exits') ~ '^[0-9]{1,3}$' then (p ->> 'exits')::integer else 0 end;
  v_away := case when (p ->> 'away_seconds') ~ '^[0-9]{1,6}$' then (p ->> 'away_seconds')::integer else 0 end;
  select coalesce(jsonb_agg(t.e order by t.n), '[]'::jsonb) into v_events
  from jsonb_array_elements(case when jsonb_typeof(p -> 'events') = 'array' then p -> 'events' else '[]'::jsonb end) with ordinality as t(e, n)
  where t.n <= 30
    and jsonb_typeof(t.e) = 'array'
    and jsonb_array_length(t.e) = 2
    and jsonb_typeof(t.e -> 0) = 'number'
    and jsonb_typeof(t.e -> 1) = 'number';
  return jsonb_build_object(
    'exits', v_exits,
    'away_seconds', v_away,
    'events', v_events,
    'ended_by_exits', coalesce((p -> 'ended_by_exits') = 'true'::jsonb, false)
  );
end;
$$;

revoke all on function public._form_exam_log_clean(jsonb) from public, anon, authenticated;

create or replace function public.submit_public_form(
  p_form_id uuid,
  p_respondent jsonb,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_form public.forms;
  v_submission uuid;
  v_sub public.form_submissions;
  v_email text;
  v_started timestamptz;
  v_elapsed numeric;
  v_late integer;
  v_log jsonb;
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

  v_email := lower(btrim(coalesce(p_respondent ->> 'email', '')));
  begin
    v_started := nullif(p_respondent ->> 'started_at', '')::timestamptz;
  exception when others then
    v_started := null;
  end;

  -- tempo de prova
  if v_form.time_limit_minutes is not null then
    if v_started is null then
      raise exception 'Não foi possível conferir o tempo da prova. Atualize a página e comece de novo.';
    end if;
    if v_started > now() then
      v_started := now(); -- relógio do aparelho adiantado: vale o do servidor
    end if;
    v_elapsed := extract(epoch from (now() - v_started));
    if v_elapsed > v_form.time_limit_minutes * 60 + 600 then
      raise exception 'O tempo desta prova terminou.';
    end if;
    if v_elapsed > v_form.time_limit_minutes * 60 + 120 then
      v_late := round(v_elapsed - v_form.time_limit_minutes * 60);
    end if;
  end if;

  -- uma resposta por e-mail (só provas do administrador; as do parceiro seguem outra regra)
  if (v_form.settings -> 'one_per_email') = 'true'::jsonb
     and v_email <> ''
     and not exists (select 1 from public.partners pt where pt.user_id = v_form.created_by) then
    perform pg_advisory_xact_lock(hashtextextended('public-form-email:' || p_form_id::text, 0));
    if exists (
      select 1 from public.form_submissions s
      where s.form_id = p_form_id and s.status <> 'in_progress'
        and lower(btrim(coalesce(s.respondent_email, ''))) = v_email
    ) then
      raise exception 'Este e-mail já respondeu esta prova.';
    end if;
  end if;

  v_log := public._form_exam_log_clean(p_respondent -> 'exam');
  if v_late is not null then
    v_log := coalesce(v_log, '{}'::jsonb) || jsonb_build_object('late_seconds', v_late);
  end if;

  insert into public.form_submissions (
    form_id, respondent_name, respondent_email, respondent_data, started_at, status, exam_log
  ) values (
    p_form_id,
    nullif(trim(coalesce(p_respondent ->> 'name', '')), ''),
    nullif(trim(coalesce(p_respondent ->> 'email', '')), ''),
    coalesce(p_respondent, '{}'::jsonb) - 'exam',
    v_started,
    'submitted',
    v_log
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

-- Aluno logado: registra as saídas da própria tentativa
create or replace function public.form_log_exam(p_submission_id uuid, p_log jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para responder.';
  end if;
  update public.form_submissions
  set exam_log = public._form_exam_log_clean(p_log)
  where id = p_submission_id
    and user_id = auth.uid()
    and (status = 'in_progress' or submitted_at > now() - interval '10 minutes');
end;
$$;

revoke all on function public.form_log_exam(uuid, jsonb) from public, anon;
grant execute on function public.form_log_exam(uuid, jsonb) to authenticated;
