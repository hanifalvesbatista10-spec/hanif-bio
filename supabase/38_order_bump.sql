-- HANIF ALVES — ORDER BUMP NO CHECKOUT
-- Permite oferecer produtos extras no checkout de um produto principal, com preço especial próprio,
-- comprados no mesmo pedido. Execute no SQL Editor do Supabase.

create table if not exists public.product_bumps (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  bump_product_id uuid not null references public.products(id) on delete cascade,
  price_cents integer not null check (price_cents > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, bump_product_id),
  check (product_id <> bump_product_id)
);

alter table public.product_bumps enable row level security;

drop policy if exists "public read product bumps" on public.product_bumps;
create policy "public read product bumps"
on public.product_bumps
for select
to anon, authenticated
using (true);

drop policy if exists "admin product bumps full" on public.product_bumps;
create policy "admin product bumps full"
on public.product_bumps
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.orders
  add column if not exists bump_product_ids uuid[] not null default '{}',
  add column if not exists bump_cents integer not null default 0;
