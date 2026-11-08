-- HANIF ALVES — PROVAS LIMITADAS A UM OU VÁRIOS CURSOS
-- O que faz:
--  1) public.form_products (prova x curso): quais cursos podem fazer cada prova de ALUNOS.
--     Sem nenhuma linha = todos os alunos (como era). Com linhas = só quem tem acesso ATIVO a pelo menos um dos cursos.
--     O curso único que algumas provas já tinham (forms.product_id) é copiado para cá. Nada é apagado: a coluna antiga
--     continua valendo junto (a regra considera os dois), então salvar pelo painel antigo não solta a prova para todos.
--  2) public.form_student_allowed(prova, aluno): a regra em um só lugar, usada pelas funções abaixo.
--  3) form_list_for_student: a aba "Atividades" só mostra a prova a quem pode fazê-la. Quem já respondeu antes continua
--     vendo a própria prova e o resultado (não pode começar nova tentativa se saiu do curso).
--  4) form_start_attempt: recusa quem não é do curso (vale também para quem abre o link direto).
--     As perguntas só são lidas com tentativa em andamento (SQL 21), então ficam protegidas junto.
--  5) form_duplicate: a cópia leva os mesmos cursos da prova original.
-- Provas públicas (link) e de parceiro não mudam: sem login não há como saber o curso.
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez.

-- 1) Tabela --------------------------------------------------------------------------------------------------------------
create table if not exists public.form_products (
  form_id uuid not null references public.forms(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (form_id, product_id)
);
create index if not exists idx_form_products_product on public.form_products(product_id);

alter table public.form_products enable row level security;
drop policy if exists "admin manage form products" on public.form_products;
create policy "admin manage form products" on public.form_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.form_products from anon;
grant all on public.form_products to authenticated;

-- provas que já tinham um curso único passam a tê-lo também na tabela nova
insert into public.form_products (form_id, product_id)
select f.id, f.product_id from public.forms f
where f.product_id is not null and f.audience = 'students'
on conflict do nothing;

-- 2) Regra: o aluno pode fazer esta prova? -------------------------------------------------------------------------------
create or replace function public.form_student_allowed(p_form_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (
      not exists (select 1 from public.form_products fp where fp.form_id = p_form_id)
      and not exists (select 1 from public.forms f where f.id = p_form_id and f.product_id is not null)
    )
    or exists (
      select 1
      from public.user_products up
      where up.user_id = p_user_id
        and up.access_status = 'active'
        and (
          up.product_id in (select fp.product_id from public.form_products fp where fp.form_id = p_form_id)
          or up.product_id = (select f.product_id from public.forms f where f.id = p_form_id)
        )
    );
$$;
revoke all on function public.form_student_allowed(uuid, uuid) from public, anon;
grant execute on function public.form_student_allowed(uuid, uuid) to authenticated;

-- 3) Iniciar tentativa (igual ao SQL 21, só a checagem do curso mudou) ---------------------------------------------------
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
  if not public.form_student_allowed(p_form_id, v_uid) then
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

revoke all on function public.form_start_attempt(uuid) from public, anon;
grant execute on function public.form_start_attempt(uuid) to authenticated;

-- 4) Lista de atividades do aluno (igual ao SQL 21, só o filtro por curso mudou) -----------------------------------------
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
  v_allowed boolean;
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
    order by x.created_at desc
  loop
    v_allowed := public.form_student_allowed(f.id, v_uid);

    select count(*) into v_used from public.form_submissions
    where form_id = f.id and user_id = v_uid and status <> 'in_progress';

    -- fora do curso da prova: some da lista, a não ser que o aluno já a tenha respondido (continua vendo o resultado)
    if not v_allowed and v_used = 0 then
      continue;
    end if;

    v_open := (f.starts_at is null or f.starts_at <= now()) and (f.ends_at is null or f.ends_at >= now());
    if not v_open and v_used = 0 then
      continue;
    end if;

    v_prog := null;
    if v_allowed then
      select * into v_prog from public.form_submissions
      where form_id = f.id and user_id = v_uid and status = 'in_progress';
      if found and v_prog.deadline_at is not null and now() > v_prog.deadline_at + interval '60 seconds' then
        v_prog := null;
      end if;
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
      'can_start', v_allowed and v_open and (f.max_attempts is null or v_used < f.max_attempts),
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

revoke all on function public.form_list_for_student() from public, anon;
grant execute on function public.form_list_for_student() to authenticated;

-- 5) Duplicar prova (igual ao SQL 52, agora copiando também os cursos) ---------------------------------------------------
create or replace function public.form_duplicate(p_form_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
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
  if not public.can_manage_form(p_form_id) then
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

  insert into public.form_products (form_id, product_id)
  select v_new, fp.product_id from public.form_products fp where fp.form_id = p_form_id
  on conflict do nothing;

  for b in select * from public.form_blocks where form_id = p_form_id order by position loop
    insert into public.form_blocks (form_id, type, title, description, image_url, options, required, points, position, topic, subtopic)
    values (v_new, b.type, b.title, b.description, b.image_url, b.options, b.required, b.points, b.position, b.topic, b.subtopic)
    returning id into v_block;
    insert into public.form_block_keys (block_id, correct, tolerance, partial_credit, annulled, feedback, feedback_image_url)
    select v_block, correct, tolerance, partial_credit, annulled, feedback, feedback_image_url
    from public.form_block_keys where block_id = b.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.form_duplicate(uuid) from public, anon;
grant execute on function public.form_duplicate(uuid) to authenticated;
