-- HANIF ALVES — PARCEIRO: REFORÇO DE SEGURANÇA (resultado da auditoria do SQL 52)
--  * funções novas de permissão deixam de ser executáveis por visitante anônimo (só autenticado);
--  * "um e-mail por prova" e o teto de respostas passam a ser à prova de envios simultâneos (trava por parceiro);
--  * e-mail e nome do aluno do parceiro são validados no banco (antes só o navegador conferia), o tamanho dos dados do
--    envio é limitado e há um teto de ritmo (60 envios por minuto por prova) contra disparo automático;
--  * nas respostas, a escrita direta pela API fica restrita ao comentário do professor (instructor_feedback): nota, aprovação,
--    liberação e vínculo com aluno só mudam pelas funções do banco;
--  * o aviso de dados da prova (settings) não pode mais ser apagado mandando um valor que não seja objeto;
--  * limite de 300 questões por prova e de tamanho dos textos, para o parceiro não encher o banco;
--  * imagens das provas: bucket forms-media aceita só JPG, PNG e WebP de até 5 MB;
--  * se um parceiro for removido, as provas dele são encerradas.
-- Execute no SQL Editor do Supabase.

-- 1) Permissões: só usuário autenticado chama as funções do parceiro --------------------------------------------------------
revoke execute on function public.is_partner(), public.owns_form(uuid), public.owns_block(uuid), public.owns_submission(uuid), public.can_manage_form(uuid)
  from public, anon;
grant execute on function public.is_partner(), public.owns_form(uuid), public.owns_block(uuid), public.owns_submission(uuid), public.can_manage_form(uuid)
  to authenticated, service_role;

-- 2) Guarda dos envios: validação, trava e ritmo ------------------------------------------------------------------------------
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
  v_name text;
begin
  select created_by into v_owner from public.forms where id = new.form_id;
  select * into v_partner from public.partners where user_id = v_owner;
  if not found then
    return new; -- prova do administrador: nada muda
  end if;
  if not v_partner.active then
    raise exception 'Esta prova está indisponível no momento.';
  end if;

  v_email := lower(btrim(coalesce(new.respondent_email, '')));
  v_name := btrim(coalesce(new.respondent_name, ''));
  if char_length(v_email) > 254 or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'Informe um e-mail válido para responder.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe o seu nome para responder.';
  end if;
  if octet_length(coalesce(new.respondent_data, '{}'::jsonb)::text) > 4000 then
    raise exception 'Dados do envio grandes demais.';
  end if;

  -- trava por parceiro: dois envios ao mesmo tempo esperam um pelo outro, então o e-mail repetido e o teto valem de verdade
  perform pg_advisory_xact_lock(hashtextextended('partner-submissions:' || v_owner::text, 0));

  if (select count(*) from public.form_submissions where form_id = new.form_id and submitted_at > now() - interval '1 minute') >= 60 then
    raise exception 'Muitas respostas em pouco tempo. Tente de novo em instantes.';
  end if;

  select count(*) into v_count
  from public.form_submissions s join public.forms f on f.id = s.form_id
  where f.created_by = v_owner;
  if v_count >= v_partner.max_responses then
    raise exception 'Esta prova atingiu o limite de respostas. Avise quem enviou o link.';
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

-- 3) Guarda das provas: settings sempre objeto (o aviso de dados não some) ---------------------------------------------------------
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
  if jsonb_typeof(new.settings) is distinct from 'object' then
    new.settings := '{}'::jsonb;
  end if;
  new.settings := new.settings
    || jsonb_build_object('data_controller', v_partner.data_controller, 'require_name', true, 'require_email', true);
  return new;
end;
$$;

-- 4) Respostas: pela API só dá para mexer no comentário do professor --------------------------------------------------------------
revoke update on public.form_submissions from authenticated, anon;
grant update (instructor_feedback) on public.form_submissions to authenticated;

-- 5) Questões: teto de quantidade e de tamanho para o parceiro -----------------------------------------------------------------------
create or replace function public.partner_block_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  if public.is_admin() or not public.is_partner() then
    return new;
  end if;
  if octet_length(coalesce(new.title, '')) > 4000
     or octet_length(coalesce(new.description, '')) > 8000
     or octet_length(coalesce(new.options::text, '')) > 8000 then
    raise exception 'Texto grande demais em uma das questões.';
  end if;
  select count(*) into v_count from public.form_blocks where form_id = new.form_id;
  if v_count >= 300 and not exists (select 1 from public.form_blocks where id = new.id) then
    raise exception 'Cada prova pode ter no máximo 300 questões.';
  end if;
  return new;
end;
$$;

drop trigger if exists form_blocks_partner_guard on public.form_blocks;
create trigger form_blocks_partner_guard before insert on public.form_blocks
  for each row execute function public.partner_block_guard();

-- 6) Imagens das provas: só JPG, PNG e WebP, até 5 MB --------------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'forms-media';

-- 7) Parceiro removido: as provas dele são encerradas ------------------------------------------------------------------------------------
create or replace function public.partner_close_forms()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.forms set status = 'closed' where created_by = old.user_id and status <> 'closed';
  return old;
end;
$$;

drop trigger if exists partners_close_forms on public.partners;
create trigger partners_close_forms before delete on public.partners
  for each row execute function public.partner_close_forms();
