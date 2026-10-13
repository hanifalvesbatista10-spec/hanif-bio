-- HANIF ALVES — PARCEIRO: ACESSO RESTRITO A PROVAS (PRÉ E PÓS-TESTE)
-- Dá a uma pessoa de confiança (um "parceiro") acesso SÓ às provas que ela mesma criou e às respostas dessas provas.
-- Nada do resto da plataforma (cursos, alunos, pedidos, finanças, leads) fica visível para ela. Não mexe no papel
-- (profiles.role) de ninguém: quem é parceiro é quem tem uma linha em public.partners, criada só pelo administrador.
--  * as provas do parceiro são sempre "qualquer pessoa com o link", nunca ligadas a produto seu e sempre dele (o banco força isso);
--  * cada prova leva o aviso de uso dos dados (settings.data_controller) com o nome dele; nome e e-mail são obrigatórios;
--  * cada e-mail responde uma vez por prova (assim o pré e o pós-teste de cada aluno não são refeitos) e há teto de provas e de
--    respostas por parceiro (padrão: 20 provas, 3.000 respostas);
--  * as correções e os resultados (funções form_*) passam a aceitar "administrador OU dono da prova";
--  * o aviso de "prova para corrigir" (Telegram) NÃO dispara para provas de parceiro;
--  * o parceiro pode enviar imagens das questões, só na pasta dele (forms-media/partners/<id do usuário>/).
-- Execute no SQL Editor do Supabase.

-- 1) Quem é parceiro -----------------------------------------------------------------------------------------------
create table if not exists public.partners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  data_controller text not null check (char_length(btrim(data_controller)) between 2 and 160),
  active boolean not null default true,
  max_forms integer not null default 20 check (max_forms >= 0),
  max_responses integer not null default 3000 check (max_responses >= 0),
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;

drop policy if exists "partners admin all" on public.partners;
create policy "partners admin all" on public.partners
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "partners read own" on public.partners;
create policy "partners read own" on public.partners
  for select to authenticated using (user_id = auth.uid());

create index if not exists forms_created_by_idx on public.forms (created_by);

-- 2) Funções de permissão ------------------------------------------------------------------------------------------
create or replace function public.is_partner()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.partners p where p.user_id = auth.uid() and p.active);
$$;

create or replace function public.owns_form(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_partner()
    and exists (select 1 from public.forms f where f.id = p_form_id and f.created_by = auth.uid());
$$;

create or replace function public.owns_block(p_block_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.form_blocks b where b.id = p_block_id and public.owns_form(b.form_id));
$$;

create or replace function public.owns_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.form_submissions s where s.id = p_submission_id and public.owns_form(s.form_id));
$$;

create or replace function public.can_manage_form(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin() or public.owns_form(p_form_id);
$$;

-- 3) Regras de acesso do parceiro (somam às do administrador, que continuam iguais) --------------------------------------
drop policy if exists "partner manage own forms" on public.forms;
create policy "partner manage own forms" on public.forms
  for all to authenticated
  using (public.is_partner() and created_by = auth.uid())
  with check (public.is_partner() and created_by = auth.uid() and audience = 'public' and product_id is null);

drop policy if exists "partner manage own form blocks" on public.form_blocks;
create policy "partner manage own form blocks" on public.form_blocks
  for all to authenticated using (public.owns_form(form_id)) with check (public.owns_form(form_id));

drop policy if exists "partner manage own block keys" on public.form_block_keys;
create policy "partner manage own block keys" on public.form_block_keys
  for all to authenticated using (public.owns_block(block_id)) with check (public.owns_block(block_id));

drop policy if exists "partner read own submissions" on public.form_submissions;
create policy "partner read own submissions" on public.form_submissions
  for select to authenticated using (public.owns_form(form_id));

drop policy if exists "partner update own submissions" on public.form_submissions;
create policy "partner update own submissions" on public.form_submissions
  for update to authenticated using (public.owns_form(form_id)) with check (public.owns_form(form_id));

drop policy if exists "partner delete own submissions" on public.form_submissions;
create policy "partner delete own submissions" on public.form_submissions
  for delete to authenticated using (public.owns_form(form_id));

drop policy if exists "partner read own answers" on public.form_answers;
create policy "partner read own answers" on public.form_answers
  for select to authenticated using (public.owns_submission(submission_id));

-- 4) Imagens das questões: só na pasta do próprio parceiro ----------------------------------------------------------------
drop policy if exists "partner upload forms media" on storage.objects;
create policy "partner upload forms media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'forms-media' and public.is_partner() and name like ('partners/' || auth.uid()::text || '/%'));

drop policy if exists "partner delete own forms media" on storage.objects;
create policy "partner delete own forms media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'forms-media' and public.is_partner() and name like ('partners/' || auth.uid()::text || '/%'));

-- 5) Gatilhos: o banco força as regras, não importa o que o navegador mande ------------------------------------------------
create or replace function public.partner_form_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_partner public.partners;
  v_count integer;
begin
  if public.is_admin() or not public.is_partner() then
    return new;
  end if;
  select * into v_partner from public.partners where user_id = auth.uid();

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.forms where created_by = auth.uid();
    if v_count >= v_partner.max_forms then
      raise exception 'Você atingiu o limite de % provas. Exclua uma antiga para criar outra.', v_partner.max_forms;
    end if;
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;

  new.audience := 'public';
  new.product_id := null;
  new.max_attempts := null;
  new.time_limit_minutes := null;
  new.pass_score := null;
  new.release_mode := 'immediate';
  new.release_at := null;
  new.settings := coalesce(new.settings, '{}'::jsonb)
    || jsonb_build_object('data_controller', v_partner.data_controller, 'require_name', true, 'require_email', true);
  return new;
end;
$$;

drop trigger if exists forms_partner_guard on public.forms;
create trigger forms_partner_guard before insert or update on public.forms
  for each row execute function public.partner_form_guard();

create or replace function public.partner_submission_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_partner public.partners;
  v_count integer;
  v_email text;
begin
  select created_by into v_owner from public.forms where id = new.form_id;
  select * into v_partner from public.partners where user_id = v_owner;
  if not found then
    return new; -- prova do administrador: nada muda
  end if;
  if not v_partner.active then
    raise exception 'Esta prova está indisponível no momento.';
  end if;

  select count(*) into v_count
  from public.form_submissions s join public.forms f on f.id = s.form_id
  where f.created_by = v_owner;
  if v_count >= v_partner.max_responses then
    raise exception 'Esta prova atingiu o limite de respostas. Avise quem enviou o link.';
  end if;

  v_email := lower(btrim(coalesce(new.respondent_email, '')));
  if v_email = '' then
    raise exception 'Informe o e-mail para responder.';
  end if;
  if exists (
    select 1 from public.form_submissions s
    where s.form_id = new.form_id and s.status <> 'in_progress'
      and lower(btrim(coalesce(s.respondent_email, ''))) = v_email
  ) then
    raise exception 'Este e-mail já respondeu esta prova.';
  end if;
  return new;
end;
$$;

drop trigger if exists form_submissions_partner_guard on public.form_submissions;
create trigger form_submissions_partner_guard before insert on public.form_submissions
  for each row execute function public.partner_submission_guard();

-- 6) Funções de resultado e correção: "administrador OU dono da prova" --------------------------------------------------------
create or replace function public.form_blocks_readable(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin()
    or public.owns_form(p_form_id)
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

create or replace function public.form_release_results(p_form_id uuid, p_ids uuid[] default null::uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  if not public.can_manage_form(p_form_id) then
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
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  if not public.can_manage_form(p_form_id) then
    raise exception 'Sem permissão.';
  end if;
  update public.form_submissions
  set results_released_at = null
  where form_id = p_form_id and id = any (p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.form_regrade(p_form_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a record;
  g record;
  v_sub uuid;
  v_count integer := 0;
begin
  if not public.can_manage_form(p_form_id) then
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

create or replace function public.form_grade_answer(p_answer_id uuid, p_points numeric, p_feedback text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ans public.form_answers;
  v_block public.form_blocks;
  v_form uuid;
begin
  if not (public.is_admin() or public.is_partner()) then
    raise exception 'Sem permissão.';
  end if;
  select * into v_ans from public.form_answers where id = p_answer_id;
  if not found then
    raise exception 'Sem permissão.';
  end if;
  select s.form_id into v_form from public.form_submissions s where s.id = v_ans.submission_id;
  if not public.can_manage_form(v_form) then
    raise exception 'Sem permissão.';
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

-- 7) Aviso "prova para corrigir" (Telegram do dono): não dispara para provas de parceiro ----------------------------------------
create or replace function public.alert_manual_grading()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_form text;
  v_owner uuid;
begin
  if new.pending_manual and new.status = 'submitted'
     and (tg_op = 'INSERT' or old.pending_manual is distinct from true) then
    select title, created_by into v_form, v_owner from public.forms where id = new.form_id;
    if exists (select 1 from public.partners where user_id = v_owner) then
      return new; -- os alunos de um parceiro não são avisados no Telegram do dono
    end if;
    perform public.notify_owner(format(E'Prova para corrigir\n%s\nAluno: %s', coalesce(v_form, '-'), coalesce(nullif(new.respondent_name, ''), new.respondent_email, 'Sem nome')));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
