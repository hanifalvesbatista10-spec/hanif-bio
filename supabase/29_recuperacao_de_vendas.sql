-- RECUPERAÇÃO DE VENDAS (carrinho abandonado e pagamento recusado)
-- Guarda, em cada pedido, se já mandamos lembrete e quando, para o robô de recuperação
-- (api/cron-recover-sales.js) não mandar duas vezes nem incomodar quem já pagou ou pediu para não receber
-- mais. As configurações (ligado/desligado e cupom do lembrete) ficam numa tabela só do admin: ninguém de
-- fora enxerga se a recuperação está ligada nem qual cupom ela usa.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 19_checkout_proprio.sql já executada).

-- 1) Pedido: até onde a recuperação já foi (0 = nada enviado, 1 = 1º lembrete, 2 = último lembrete)
alter table public.orders add column if not exists recovery_stage integer not null default 0;
alter table public.orders add column if not exists recovery_last_sent_at timestamptz;
alter table public.orders add column if not exists recovery_opt_out boolean not null default false;

alter table public.orders drop constraint if exists orders_recovery_stage_check;
alter table public.orders add constraint orders_recovery_stage_check check (recovery_stage between 0 and 2);

create index if not exists orders_recovery_idx on public.orders (status, recovery_stage, created_at)
  where status in ('pending', 'failed');

-- 2) Configuração: ligar/desligar os e-mails automáticos e o cupom (opcional) que eles oferecem
create table if not exists public.recovery_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  coupon_code text,
  updated_at timestamptz not null default now()
);

insert into public.recovery_settings (id) values (1)
on conflict (id) do nothing;

alter table public.recovery_settings enable row level security;

-- só o admin lê e edita (nem o cupom nem se está ligado aparecem para o público)
drop policy if exists "admin manage recovery settings" on public.recovery_settings;
create policy "admin manage recovery settings"
on public.recovery_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
