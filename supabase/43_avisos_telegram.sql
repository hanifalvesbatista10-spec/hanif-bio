-- HANIF ALVES — AVISOS NO TELEGRAM DO QUE ACONTECE NO BANCO
-- Manda uma mensagem no seu Telegram quando: um aluno se cadastra, um aluno comenta numa aula, uma prova
-- precisa de correção manual, um depoimento chega para aprovar, alguém pede para ser afiliado ou alguém se
-- inscreve num evento. (Venda, pedido sem pagamento, falha de pagamento e reembolso são avisados pelo
-- servidor da Vercel, não por aqui.)
--
-- O token do bot e o seu número de chat ficam no Vault do Supabase (criptografados), nunca neste arquivo.
-- PASSO 1 — rode este arquivo inteiro no SQL Editor.
-- PASSO 2 — em outra consulta, guarde os dois segredos, trocando pelos SEUS valores (rode uma vez só):
--     select vault.create_secret('COLE_AQUI_O_TOKEN_DO_BOT', 'telegram_bot_token');
--     select vault.create_secret('COLE_AQUI_O_NUMERO_DO_CHAT', 'telegram_chat_id');
--   Para trocar o token depois (ex.: revogou no BotFather):
--     select vault.update_secret((select id from vault.secrets where name = 'telegram_bot_token'), 'NOVO_TOKEN');
-- PASSO 3 — teste: select public.notify_owner('Teste dos avisos do banco');

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_owner(message text)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_token text;
  v_chat text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_chat_id' limit 1;
  if v_token is null or v_chat is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('chat_id', v_chat, 'text', left(message, 3500))
  );
exception when others then
  -- um aviso nunca pode impedir o cadastro/comentário/envio que o disparou
  null;
end;
$$;

revoke all on function public.notify_owner(text) from public, anon, authenticated;

-- 1) Novo aluno cadastrado
create or replace function public.alert_new_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'student' then
    perform public.notify_owner(format(E'Novo aluno cadastrado\n%s (%s)', coalesce(nullif(new.full_name, ''), 'Sem nome'), new.email));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists alert_new_student on public.profiles;
create trigger alert_new_student after insert on public.profiles
for each row execute function public.alert_new_student();

-- 2) Comentário de aluno numa aula
create or replace function public.alert_new_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lesson text;
begin
  if new.author_role = 'student' then
    select title into v_lesson from public.product_lessons where id = new.lesson_id;
    perform public.notify_owner(format(E'Novo comentário em aula\nAula: %s\n%s: %s', coalesce(v_lesson, '-'), new.author_name, left(new.body, 400)));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists alert_new_comment on public.lesson_comments;
create trigger alert_new_comment after insert on public.lesson_comments
for each row execute function public.alert_new_comment();

-- 3) Prova ou atividade que precisa de correção manual (só avisa na virada para "precisa corrigir")
create or replace function public.alert_manual_grading()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_form text;
begin
  if new.pending_manual and new.status = 'submitted'
     and (tg_op = 'INSERT' or old.pending_manual is distinct from true) then
    select title into v_form from public.forms where id = new.form_id;
    perform public.notify_owner(format(E'Prova para corrigir\n%s\nAluno: %s', coalesce(v_form, '-'), coalesce(nullif(new.respondent_name, ''), new.respondent_email, 'Sem nome')));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists alert_manual_grading on public.form_submissions;
create trigger alert_manual_grading after insert or update of pending_manual, status on public.form_submissions
for each row execute function public.alert_manual_grading();

-- 4) Depoimento esperando aprovação
create or replace function public.alert_feedback_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'review' and (tg_op = 'INSERT' or old.status is distinct from 'review') then
    perform public.notify_owner(format(E'Novo depoimento para aprovar\n%s: %s', new.student_name, left(new.testimonial, 300)));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists alert_feedback_review on public.student_feedbacks;
create trigger alert_feedback_review after insert or update of status on public.student_feedbacks
for each row execute function public.alert_feedback_review();

-- 5) Pedido para ser afiliado
create or replace function public.alert_new_affiliate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_owner(format(E'Novo pedido de afiliado\n%s (%s)\nWhatsApp: %s\n%s', new.full_name, new.email, coalesce(new.phone, '-'), left(coalesce(new.notes, ''), 300)));
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists alert_new_affiliate on public.affiliates;
create trigger alert_new_affiliate after insert on public.affiliates
for each row execute function public.alert_new_affiliate();

-- 6) Inscrição em evento
create or replace function public.alert_event_registration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_owner(format(E'Nova inscrição em evento\nEvento: %s\n%s\nWhatsApp: %s\n%s', new.event_slug, new.full_name, new.whatsapp, new.email));
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists alert_event_registration on public.event_registrations;
create trigger alert_event_registration after insert on public.event_registrations
for each row execute function public.alert_event_registration();
