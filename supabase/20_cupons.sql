-- CUPONS DE DESCONTO DO CHECKOUT PRÓPRIO
-- Cria a tabela de cupons (só o admin lê e edita; o desconto é calculado no servidor, nunca no navegador)
-- e registra o cupom usado em cada pedido. Também permite pedido de valor zero (cupom de 100%: acesso grátis).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 19_checkout_proprio.sql já executada).

-- 1) Cupons
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  -- percent: 1 a 100. fixed: valor em centavos (ex.: 5000 = R$ 50,00)
  discount_value integer not null check (discount_value > 0),
  product_id uuid references public.products(id) on delete cascade, -- nulo = vale para todos os produtos do checkout
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0), -- nulo = ilimitado
  one_per_customer boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_percent_range check (discount_type <> 'percent' or discount_value <= 100)
);

-- O código não diferencia maiúsculas de minúsculas
create unique index if not exists coupons_code_unique on public.coupons (upper(code));

alter table public.coupons enable row level security;

drop policy if exists "coupons admin full" on public.coupons;
create policy "coupons admin full" on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Pedido guarda o cupom, o desconto e o preço de tabela
alter table public.orders add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_cents integer not null default 0;
alter table public.orders add column if not exists list_price_cents integer;

-- 3) Cupom de 100% gera pedido de valor zero (acesso grátis, sem passar pelo gateway)
alter table public.orders drop constraint if exists orders_amount_cents_check;
alter table public.orders add constraint orders_amount_cents_check check (amount_cents >= 0);

create index if not exists orders_coupon_idx on public.orders (coupon_id);
