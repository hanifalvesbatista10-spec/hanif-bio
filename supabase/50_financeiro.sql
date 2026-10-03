-- HANIF ALVES — ABA FINANCEIRO
-- Duas tabelas novas, visíveis e editáveis apenas pelo administrador (public.is_admin()):
--  * finance_entries: despesas e receitas avulsas (ex.: anúncios, ferramentas, venda fechada pelo WhatsApp), com recorrência mensal opcional;
--  * finance_settings: uma única linha com as taxas de cada forma de pagamento (estimativas), o imposto (opcional, desligado por padrão) e a meta mensal.
-- As vendas continuam vindo de public.orders e as comissões de public.affiliate_commissions. Execute no SQL Editor do Supabase.

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('expense', 'income')),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  amount_cents integer not null check (amount_cents > 0),
  occurred_on date not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'monthly')),
  recurrence_until date,
  created_at timestamptz not null default now(),
  check (recurrence_until is null or recurrence = 'monthly'),
  check (recurrence_until is null or recurrence_until >= occurred_on)
);

create index if not exists finance_entries_date_idx on public.finance_entries (occurred_on desc);

create table if not exists public.finance_settings (
  id integer primary key default 1 check (id = 1),
  fee_pix_percent numeric(5, 2) not null default 0 check (fee_pix_percent between 0 and 100),
  fee_card_percent numeric(5, 2) not null default 0 check (fee_card_percent between 0 and 100),
  fee_boleto_cents integer not null default 0 check (fee_boleto_cents >= 0),
  tax_enabled boolean not null default false,
  tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  monthly_goal_cents integer not null default 0 check (monthly_goal_cents >= 0),
  updated_at timestamptz not null default now()
);

insert into public.finance_settings (id) values (1) on conflict (id) do nothing;

alter table public.finance_entries enable row level security;
alter table public.finance_settings enable row level security;

drop policy if exists "finance entries admin all" on public.finance_entries;
create policy "finance entries admin all" on public.finance_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "finance settings admin all" on public.finance_settings;
create policy "finance settings admin all" on public.finance_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
