-- CHECKOUT PRÓPRIO (ASAAS): PEDIDOS, EVENTOS DE PAGAMENTO E LIBERAÇÃO AUTOMÁTICA DE ACESSO
-- Cria: modo de checkout por produto (externo = link atual; interno = checkout do site), tabela de
-- pedidos, tabela de eventos recebidos do Asaas (evita processar o mesmo aviso duas vezes) e um
-- gatilho que libera os cursos já pagos quando o comprador cria a conta depois.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: nada muda no site até você ativar o checkout próprio em um produto.

-- 1) Modo de checkout do produto
alter table public.products add column if not exists checkout_mode text not null default 'external';
alter table public.products drop constraint if exists products_checkout_mode_check;
alter table public.products
  add constraint products_checkout_mode_check check (checkout_mode in ('external', 'internal'));

-- 2) Pedidos. Só o servidor (função com a chave de serviço) cria e atualiza; admin e o próprio comprador leem.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_cpf text,
  buyer_phone text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'brl',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  payment_method text check (payment_method is null or payment_method in ('pix', 'boleto', 'card')),
  provider text not null default 'asaas',
  provider_payment_id text unique,
  payment_url text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_email_idx on public.orders (lower(buyer_email));
create index if not exists orders_user_idx on public.orders (user_id);

alter table public.orders enable row level security;

drop policy if exists "orders admin full" on public.orders;
create policy "orders admin full" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders own read" on public.orders;
create policy "orders own read" on public.orders
  for select to authenticated using (user_id = auth.uid());

-- 3) Avisos já processados (idempotência do webhook). Sem policy: só a chave de serviço acessa.
create table if not exists public.payment_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.payment_events enable row level security;

-- 4) Comprou antes de ter conta? Quando o perfil nasce com o mesmo e-mail, o pedido pago é ligado
-- à conta e o curso é liberado na hora.
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
  select distinct new.id, o.product_id, 'active'
    from public.orders o
   where o.user_id = new.id and o.status = 'paid'
  on conflict (user_id, product_id) do update set access_status = 'active';

  return new;
end;
$$;

drop trigger if exists profiles_grant_paid_orders on public.profiles;
create trigger profiles_grant_paid_orders
after insert on public.profiles
for each row execute function public.grant_paid_orders_to_new_profile();
