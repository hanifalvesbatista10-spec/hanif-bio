-- SISTEMA DE AFILIADOS
-- Quem promove seus produtos ganha comissão pelas vendas que gerar. O rastreamento é pelo mesmo sistema de
-- cupons que já existe: cada afiliado aprovado ganha um cupom exclusivo (com desconto para quem compra), e
-- quando um pedido com esse cupom é pago, a comissão é calculada e guardada num registro à parte. O
-- pagamento da comissão é feito por você, por fora (Pix); o site só calcula e mostra quanto cada um tem a
-- receber, e você marca como pago quando transferir.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 20_cupons.sql já executada).

-- 1) Afiliados
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  pix_key text,
  notes text, -- o que a pessoa escreveu no formulário (ex.: onde pretende divulgar)
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'blocked')),
  commission_percent numeric(5,2), -- nulo = usa o padrão de affiliate_settings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create unique index if not exists affiliates_email_unique on public.affiliates (lower(email));

drop trigger if exists affiliates_updated on public.affiliates;
create trigger affiliates_updated before update on public.affiliates
for each row execute function public.set_updated_at();

alter table public.affiliates enable row level security;

drop policy if exists "affiliates admin full" on public.affiliates;
create policy "affiliates admin full" on public.affiliates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Formulário público "quero ser afiliado": qualquer um pode se inscrever, mas só como pedido pendente
-- (não dá para se autoaprovar nem já chegar com uma comissão definida).
drop policy if exists "affiliates public apply" on public.affiliates;
create policy "affiliates public apply" on public.affiliates
  for insert to anon, authenticated
  with check (status = 'pending' and commission_percent is null and approved_at is null);

-- 2) Cupom ligado a um afiliado: o cupom É o link/código do afiliado (reaproveita o sistema da 20_cupons.sql)
alter table public.coupons add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null;

create index if not exists coupons_affiliate_idx on public.coupons (affiliate_id) where affiliate_id is not null;

-- 3) Configuração: comissão padrão e se aceita novos pedidos (só o admin vê; o público só sabe se está aberto)
create table if not exists public.affiliate_settings (
  id integer primary key default 1 check (id = 1),
  default_commission_percent numeric(5,2) not null default 10,
  signup_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.affiliate_settings (id) values (1)
on conflict (id) do nothing;

alter table public.affiliate_settings enable row level security;

drop policy if exists "admin manage affiliate settings" on public.affiliate_settings;
create policy "admin manage affiliate settings" on public.affiliate_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.affiliate_signup_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select signup_enabled from public.affiliate_settings where id = 1), true);
$$;

revoke all on function public.affiliate_signup_open() from public;
grant execute on function public.affiliate_signup_open() to anon, authenticated;

-- 4) Comissões: uma linha por pedido pago com cupom de afiliado (nunca duas, mesmo se o aviso repetir)
create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  base_cents integer not null,
  percent_used numeric(5,2) not null,
  amount_cents integer not null,
  status text not null default 'owed' check (status in ('owed', 'paid', 'void')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists affiliate_commissions_order_unique on public.affiliate_commissions (order_id);
create index if not exists affiliate_commissions_affiliate_idx on public.affiliate_commissions (affiliate_id, status);

alter table public.affiliate_commissions enable row level security;

drop policy if exists "affiliate commissions admin full" on public.affiliate_commissions;
create policy "affiliate commissions admin full" on public.affiliate_commissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
