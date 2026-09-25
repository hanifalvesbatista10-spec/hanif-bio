-- SUBTEMA DAS QUESTÕES (base da ficha de desempenho do aluno)
-- Cada questão já tem um "tema" (ex.: Trauma). Agora também pode ter um "subtema": a parte específica
-- que a questão cobra (ex.: "B - Respiração", "C - Circulação"). Com os dois, a ficha do aluno mostra
-- "no Trauma ele erra no B e no C".
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

alter table public.form_blocks add column if not exists subtopic text;

-- duplicar uma prova passa a copiar também o subtema
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
