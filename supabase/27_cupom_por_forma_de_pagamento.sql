-- CUPOM POR FORMA DE PAGAMENTO
-- Permite limitar um cupom a "Pix ou cartão" (InfinitePay), a "Boleto" (Asaas) ou deixar valer para todos.
-- A regra é conferida no servidor (api/coupon-check e api/checkout-create), nunca no navegador.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 20_cupons.sql já executada).

-- nulo = vale para qualquer forma de pagamento; senão a lista das formas aceitas: 'online' (Pix ou cartão) e/ou 'boleto'
alter table public.coupons add column if not exists payment_methods text[];

alter table public.coupons drop constraint if exists coupons_payment_methods_valid;
alter table public.coupons add constraint coupons_payment_methods_valid
  check (payment_methods is null or (cardinality(payment_methods) between 1 and 2 and payment_methods <@ array['online', 'boleto']::text[]));
