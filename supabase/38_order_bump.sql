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

-- Corrige o gatilho de "comprou antes de ter conta" (SQL 19) para também liberar os produtos do
-- order bump quando o comprador cria a conta depois. O join com products garante que um bump
-- apagado não trave a liberação do produto principal (sem isso, unnest sozinho tentaria inserir
-- um product_id que não existe mais e a transação do trigger inteira falharia).
create or replace function public.grant_paid_orders_to_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.email, '') = '' then
    return new;
  end if;

  update public.orders
     set user_id = new.id, updated_at = now()
   where user_id is null and status = 'paid' and lower(buyer_email) = lower(new.email);

  insert into public.user_products (user_id, product_id, access_status)
  select distinct new.id, p.id, 'active'
    from public.orders o
    cross join lateral unnest(array[o.product_id] || coalesce(o.bump_product_ids, '{}')) as x(pid)
    join public.products p on p.id = x.pid
   where o.user_id = new.id and o.status = 'paid'
  on conflict (user_id, product_id) do update set access_status = 'active';

  return new;
end;
$$;
