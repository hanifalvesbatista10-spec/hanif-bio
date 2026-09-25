-- DESEMPENHO: VISÃO DA TURMA (instrutor) E "MEU DESEMPENHO" (aluno)
--  * class_performance(curso): só o administrador. Junta as respostas de todos os alunos do curso
--    (ou de todos, sem curso) e devolve: temas críticos, questões que mais erram, ranking e comparação entre provas.
--  * my_performance(): o aluno vê o próprio desempenho, só com resultados JÁ LIBERADOS, e as aulas para rever.
--  * product_lessons.topics: os temas que cada aula ensina ("Trauma" ou "Trauma > B - Respiração"),
--    para indicar a aula certa quando o aluno vai mal num assunto.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

alter table public.product_lessons add column if not exists topics text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Visão da turma (administrador)
-- ---------------------------------------------------------------------------
create or replace function public.class_performance(p_product_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;

  with st as (
    select p.id, p.full_name, p.email, p.last_access
    from public.profiles p
    where p.role = 'student' and p.account_status = 'active'
      and (
        p_product_id is null
        or exists (
          select 1 from public.user_products up
          where up.user_id = p.id and up.product_id = p_product_id and up.access_status = 'active'
        )
      )
  ),
  subs as (
    select s.id, s.user_id, s.form_id, s.submitted_at, s.score, s.max_score, s.passed, s.pending_manual
    from public.form_submissions s
    join st on st.id = s.user_id
    where s.status <> 'in_progress'
  ),
  gr as (
    select s.user_id, s.form_id, b.id as block_id, b.title, b.topic, b.subtopic, b.points,
           least(coalesce(a.points_awarded, 0), b.points) as earned,
           a.answer::text as answer_text, k.correct, k.feedback
    from public.form_answers a
    join subs s on s.id = a.submission_id
    join public.form_blocks b on b.id = a.block_id
    left join public.form_block_keys k on k.block_id = b.id
    where b.points > 0
      and b.type not in ('heading', 'text', 'image', 'scale')
      and not a.needs_review
      and coalesce(k.annulled, false) = false
  ),
  topic_stats as (
    select lower(trim(coalesce(nullif(trim(topic), ''), 'Sem tema'))) as tk,
           min(coalesce(nullif(trim(topic), ''), 'Sem tema')) as label,
           count(*) as answered,
           count(*) filter (where earned < points) as wrong,
           sum(earned) as earned,
           sum(points) as possible,
           count(distinct user_id) as students,
           count(distinct user_id) filter (where earned < points) as students_wrong
    from gr group by 1
  ),
  sub_stats as (
    select lower(trim(coalesce(nullif(trim(topic), ''), 'Sem tema'))) as tk,
           lower(trim(coalesce(nullif(trim(subtopic), ''), 'Sem subtema'))) as sk,
           min(coalesce(nullif(trim(subtopic), ''), 'Sem subtema')) as label,
           count(*) as answered,
           count(*) filter (where earned < points) as wrong,
           sum(earned) as earned,
           sum(points) as possible,
           count(distinct user_id) as students,
           count(distinct user_id) filter (where earned < points) as students_wrong
    from gr group by 1, 2
  ),
  wc as (
    select block_id, answer_text, count(*) as n,
           row_number() over (partition by block_id order by count(*) desc, answer_text) as rn
    from gr where earned < points group by block_id, answer_text
  ),
  q as (
    select g.block_id, g.title, g.topic, g.subtopic, g.form_id,
           (array_agg(g.correct))[1] as correct, (array_agg(g.feedback))[1] as feedback,
           count(*) as answered,
           count(*) filter (where g.earned < g.points) as wrong,
           count(distinct g.user_id) filter (where g.earned < g.points) as students_wrong,
           count(distinct g.user_id) as students
    from gr g group by g.block_id, g.title, g.topic, g.subtopic, g.form_id
  ),
  per_student as (
    select user_id, count(*) as attempts,
           round(avg(case when max_score > 0 and not pending_manual then score / max_score * 100 end))::int as avg,
           max(submitted_at) as last,
           count(*) filter (where pending_manual) as pending
    from subs group by user_id
  ),
  per_form as (
    select s.form_id, count(*) as attempts, count(distinct s.user_id) as students,
           min(s.submitted_at) as first_at,
           round(avg(case when s.max_score > 0 and not s.pending_manual then s.score / s.max_score * 100 end))::int as avg,
           count(*) filter (where s.passed) as passed,
           count(*) filter (where s.passed is not null) as judged
    from subs s group by s.form_id
  )
  select jsonb_build_object(
    'overview', jsonb_build_object(
      'students_total', (select count(*) from st),
      'students_answered', (select count(*) from per_student),
      'avg', (select round(avg(avg))::int from per_student where avg is not null),
      'pass_rate', (select case when sum(judged) > 0 then round(sum(passed)::numeric / sum(judged) * 100)::int end from per_form),
      'attempts', (select coalesce(sum(attempts), 0) from per_student)
    ),
    'students', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.full_name, 'email', st.email, 'last_access', st.last_access,
        'attempts', coalesce(ps.attempts, 0), 'avg', ps.avg, 'last', ps.last, 'pending', coalesce(ps.pending, 0)
      ) order by ps.avg nulls last, st.full_name), '[]'::jsonb)
      from st left join per_student ps on ps.user_id = st.id
    ),
    'topics', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'topic', t.label, 'answered', t.answered, 'wrong', t.wrong, 'students', t.students, 'students_wrong', t.students_wrong,
        'percent', case when t.possible > 0 then round(t.earned / t.possible * 100)::int end,
        'subtopics', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'subtopic', s2.label, 'answered', s2.answered, 'wrong', s2.wrong, 'students', s2.students, 'students_wrong', s2.students_wrong,
            'percent', case when s2.possible > 0 then round(s2.earned / s2.possible * 100)::int end
          ) order by case when s2.possible > 0 then s2.earned / s2.possible end nulls last), '[]'::jsonb)
          from sub_stats s2 where s2.tk = t.tk
        )
      ) order by case when t.possible > 0 then t.earned / t.possible end nulls last), '[]'::jsonb)
      from topic_stats t
    ),
    'questions', (
      select coalesce(jsonb_agg(x.j order by x.rate desc, x.wrong desc), '[]'::jsonb)
      from (
        select q.wrong, q.wrong::numeric / q.answered as rate,
               jsonb_build_object(
                 'block_id', q.block_id, 'title', q.title, 'topic', coalesce(nullif(trim(q.topic), ''), 'Sem tema'),
                 'subtopic', coalesce(nullif(trim(q.subtopic), ''), ''), 'form_title', f.title,
                 'answered', q.answered, 'wrong', q.wrong, 'students', q.students, 'students_wrong', q.students_wrong,
                 'correct', q.correct, 'feedback', q.feedback,
                 'top_wrong', w.answer_text, 'top_wrong_count', w.n
               ) as j
        from q
        join public.forms f on f.id = q.form_id
        left join wc w on w.block_id = q.block_id and w.rn = 1
        where q.answered >= 3 and q.wrong > 0
        order by q.wrong::numeric / q.answered desc, q.wrong desc
        limit 80
      ) x
    ),
    'forms', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id, 'title', f.title, 'type', f.type, 'first_at', pf.first_at, 'attempts', pf.attempts,
        'students', pf.students, 'avg', pf.avg, 'passed', pf.passed, 'judged', pf.judged
      ) order by pf.first_at), '[]'::jsonb)
      from per_form pf join public.forms f on f.id = pf.form_id
    )
  ) into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Meu desempenho (aluno logado): só resultados já liberados
-- ---------------------------------------------------------------------------
create or replace function public.my_performance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.';
  end if;

  with subs as (
    select s.id, s.form_id, s.submitted_at, s.score, s.max_score, s.passed, s.pending_manual
    from public.form_submissions s
    join public.forms f on f.id = s.form_id
    where s.user_id = v_uid and s.status <> 'in_progress' and public._form_is_released(s, f)
  ),
  gr as (
    select b.topic, b.subtopic, b.points, least(coalesce(a.points_awarded, 0), b.points) as earned
    from public.form_answers a
    join subs s on s.id = a.submission_id
    join public.form_blocks b on b.id = a.block_id
    left join public.form_block_keys k on k.block_id = b.id
    where b.points > 0
      and b.type not in ('heading', 'text', 'image', 'scale')
      and not a.needs_review
      and coalesce(k.annulled, false) = false
  ),
  topic_stats as (
    select lower(trim(coalesce(nullif(trim(topic), ''), 'Sem tema'))) as tk,
           min(coalesce(nullif(trim(topic), ''), 'Sem tema')) as label,
           count(*) as answered, sum(earned) as earned, sum(points) as possible
    from gr group by 1
  ),
  sub_stats as (
    select lower(trim(coalesce(nullif(trim(topic), ''), 'Sem tema'))) as tk,
           lower(trim(coalesce(nullif(trim(subtopic), ''), 'Sem subtema'))) as sk,
           min(coalesce(nullif(trim(subtopic), ''), 'Sem subtema')) as label,
           count(*) as answered, sum(earned) as earned, sum(points) as possible
    from gr group by 1, 2
  ),
  weak as (
    select t.label as topic, null::text as subtopic, t.answered,
           round(t.earned / t.possible * 100)::int as pct
    from topic_stats t
    where t.answered >= 3 and t.possible > 0 and t.earned / t.possible * 100 < 60
    union all
    select t.label, s.label, s.answered, round(s.earned / s.possible * 100)::int
    from sub_stats s join topic_stats t on t.tk = s.tk
    where s.answered >= 3 and s.possible > 0 and s.earned / s.possible * 100 < 60 and s.sk <> 'sem subtema'
  )
  select jsonb_build_object(
    'overall', jsonb_build_object(
      'attempts', (select count(*) from subs),
      'avg', (select round(avg(score / max_score * 100))::int from subs where max_score > 0 and not pending_manual),
      'passed', (select count(*) from subs where passed is true),
      'failed', (select count(*) from subs where passed is false),
      'last', (select max(submitted_at) from subs)
    ),
    'topics', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'topic', t.label, 'answered', t.answered,
        'percent', case when t.possible > 0 then round(t.earned / t.possible * 100)::int end,
        'subtopics', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'subtopic', s.label, 'answered', s.answered,
            'percent', case when s.possible > 0 then round(s.earned / s.possible * 100)::int end
          ) order by case when s.possible > 0 then s.earned / s.possible end nulls last), '[]'::jsonb)
          from sub_stats s where s.tk = t.tk and s.sk <> 'sem subtema'
        )
      ) order by case when t.possible > 0 then t.earned / t.possible end nulls last), '[]'::jsonb)
      from topic_stats t
    ),
    'weak', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'topic', w.topic, 'subtopic', w.subtopic, 'percent', w.pct, 'answered', w.answered,
        'lessons', (
          select coalesce(jsonb_agg(l.j), '[]'::jsonb) from (
            select d.j from (
              select distinct on (pl.id) pl.title, jsonb_build_object('id', pl.id, 'title', pl.title, 'product_id', k.product_id) as j
              from public.product_lessons pl
              join public.product_lesson_links k on k.lesson_id = pl.id
              join public.user_products up on up.product_id = k.product_id and up.user_id = v_uid and up.access_status = 'active'
              where pl.status = 'published'
                and exists (
                  select 1 from unnest(pl.topics) tp
                  where (w.subtopic is null and public.form_norm(split_part(tp, '>', 1)) = public.form_norm(w.topic))
                     or (w.subtopic is not null and public.form_norm(tp) in (
                          public.form_norm(w.topic || ' > ' || w.subtopic),
                          public.form_norm(w.subtopic)))
                )
              order by pl.id, k.product_id
            ) d
            order by d.title
            limit 3
          ) l
        )
      ) order by w.pct), '[]'::jsonb)
      from weak w
    )
  ) into v;

  return v;
end;
$$;

revoke all on function public.class_performance(uuid) from public, anon;
revoke all on function public.my_performance() from public, anon;
grant execute on function public.class_performance(uuid) to authenticated;
grant execute on function public.my_performance() to authenticated;
