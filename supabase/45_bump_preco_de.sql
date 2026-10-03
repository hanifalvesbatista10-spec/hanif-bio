-- HANIF ALVES — ORDER BUMP COM "PREÇO DE" PRÓPRIO
-- Cada oferta extra do checkout pode ter o seu "preço de" (o valor riscado, de referência) para mostrar o
-- desconto, sem precisar cadastrar preço no produto. Vazio = o checkout usa o preço do próprio produto.
-- Execute no SQL Editor do Supabase.

alter table public.product_bumps
  add column if not exists list_price_cents integer check (list_price_cents is null or list_price_cents > 0);
