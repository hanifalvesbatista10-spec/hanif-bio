-- HANIF ALVES — PARCEIRO: O MESMO E-MAIL PODE RESPONDER A PROVA MAIS DE UMA VEZ
-- Problema: nas provas do parceiro (pré e pós-teste), o banco recusava o envio quando o e-mail já tinha respondido aquela prova
-- ("Este e-mail já respondeu esta prova."). O aluno que fez o pré-teste e voltava para o pós-teste pelo mesmo link, com o mesmo
-- e-mail, ficava barrado no fim da prova e acabava usando outro e-mail, o que quebrava a comparação entre pré e pós.
-- Correção: a regra "um e-mail por prova" sai da guarda dos envios (SQL 53). Continuam valendo todas as outras proteções:
-- e-mail e nome válidos, tamanho dos dados, prova encerrada se o parceiro estiver inativo, teto de 60 envios por minuto por prova
-- e o teto de respostas do parceiro (partners.max_responses), tudo ainda à prova de envios simultâneos.
-- Só troca o corpo de uma função; não altera nem apaga dado. Execute no SQL Editor do Supabase.

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

  -- trava por parceiro: dois envios ao mesmo tempo esperam um pelo outro, então o teto vale de verdade
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

  return new;
end;
$$;
