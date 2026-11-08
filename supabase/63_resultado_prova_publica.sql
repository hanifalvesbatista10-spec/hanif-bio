-- HANIF ALVES — RESULTADO DA PROVA PÚBLICA (VOLTAR PELO LINK PARA VER ERROS E ACERTOS)
-- O que faz:
--  1) form_submissions.result_token: código secreto (uuid aleatório) de cada resposta. As respostas que já existem também recebem um.
--     Só quem enxerga a linha (administrador, parceiro dono da prova, o próprio aluno logado) lê o código; não há leitura pública da tabela.
--  2) submit_public_form: passa a devolver o result_token (o resto continua igual ao SQL 62).
--  3) public_form_get_result(token): quem tem o link vê o resultado da PRÓPRIA resposta, sem login, com as mesmas regras de liberação
--     das provas dos alunos (form_get_my_result): antes da liberação só volta o "aguardando"; depois da liberação vêm nota, respostas,
--     gabarito e comentários (gabarito só se settings.show_key não for false). Só serve resposta de prova pública (audience = 'public').
--     Provas de PARCEIRO ficam de fora de propósito: o pré-teste e o pós-teste usam as mesmas perguntas, e mostrar o gabarito no fim
--     do pré-teste entregaria as respostas do pós. Nelas o código não é devolvido e a função recusa.
-- Não altera respostas existentes nem as regras de liberação. Execute no SQL Editor do Supabase.

alter table public.form_submissions add column if not exists result_token uuid default gen_random_uuid();
update public.form_submissions set result_token = gen_random_uuid() where result_token is null;
alter table public.form_submissions alter column result_token set not null;
create unique index if not exists idx_form_submissions_result_token on public.form_submissions(result_token);

-- Devolve também o código do resultado (mesma função do SQL 62, só com o campo novo no retorno)
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
  v_partner boolean;
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

  v_partner := exists (select 1 from public.partners pt where pt.user_id = v_form.created_by);
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
     and not v_partner then
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
    'result_token', case when v_partner then null else v_sub.result_token end,
    'score', v_sub.score,
    'max_score', v_sub.max_score,
    'pending_manual', v_sub.pending_manual
  );
end;
$$;

revoke all on function public.submit_public_form(uuid, jsonb, jsonb) from public;
grant execute on function public.submit_public_form(uuid, jsonb, jsonb) to anon, authenticated;

-- Resultado de uma resposta de prova pública, por código secreto (sem login)
create or replace function public.public_form_get_result(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sub public.form_submissions;
  v_form public.forms;
  v_released boolean;
  v_show_key boolean;
  v_base jsonb;
  v_items jsonb;
begin
  if p_token is null then
    raise exception 'Resultado não encontrado.';
  end if;
  select * into v_sub from public.form_submissions where result_token = p_token;
  if not found or v_sub.status = 'in_progress' then
    raise exception 'Resultado não encontrado.';
  end if;
  select * into v_form from public.forms where id = v_sub.form_id;
  if v_form.audience <> 'public' or exists (select 1 from public.partners pt where pt.user_id = v_form.created_by) then
    raise exception 'Resultado não encontrado.';
  end if;
  v_released := public._form_is_released(v_sub, v_form);

  v_base := jsonb_build_object(
    'submission_id', v_sub.id,
    'status', v_sub.status,
    'attempt_number', coalesce(v_sub.attempt_number, 1),
    'submitted_at', v_sub.submitted_at,
    'pending_manual', v_sub.pending_manual,
    'released', v_released,
    'release_mode', v_form.release_mode,
    'release_at', v_form.release_at,
    'respondent_name', v_sub.respondent_name,
    'form', jsonb_build_object(
      'id', v_form.id, 'slug', v_form.slug, 'title', v_form.title, 'type', v_form.type,
      'pass_score', v_form.pass_score, 'max_attempts', v_form.max_attempts
    )
  );
  if not v_released then
    return v_base;
  end if;

  v_show_key := coalesce((v_form.settings ->> 'show_key')::boolean, true);

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
    'key_note', 'O gabarito e os comentários não estão disponíveis nesta prova.',
    'items', v_items
  );
end;
$$;

revoke all on function public.public_form_get_result(uuid) from public;
grant execute on function public.public_form_get_result(uuid) to anon, authenticated;
