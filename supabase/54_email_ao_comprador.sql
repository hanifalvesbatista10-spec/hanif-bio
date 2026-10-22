-- HANIF ALVES — E-MAIL AO COMPRADOR (CONFIRMAÇÃO DE COMPRA E LEMBRETE DE CADASTRO)
-- Registra, em cada pedido, que o e-mail de "compra confirmada" foi enviado (uma vez só, mesmo que o aviso do gateway chegue
-- repetido) e em que etapa está o lembrete para quem pagou e ainda não criou conta (etapa 0 = nenhum, 1 = primeiro lembrete,
-- 2 = último). O índice acelera a busca diária de quem pagou e ainda não tem conta. Execute no SQL Editor do Supabase.

alter table public.orders
  add column if not exists buyer_email_sent_at timestamptz,
  add column if not exists buyer_email_error text,
  add column if not exists access_reminder_stage integer not null default 0,
  add column if not exists access_reminder_sent_at timestamptz;

create index if not exists orders_access_reminder_idx on public.orders (paid_at) where status = 'paid' and user_id is null;
