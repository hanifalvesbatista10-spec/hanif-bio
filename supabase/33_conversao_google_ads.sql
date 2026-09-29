-- CONVERSÃO DO GOOGLE ADS: marca o pedido pago cuja conversão já foi enviada (uma vez por pedido).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run. Rode ANTES de publicar o site.
-- Migration incremental e não destrutiva.
alter table public.orders add column if not exists ads_conversion_sent_at timestamptz;

-- Pedidos pagos antes desta mudança não entram (senão contariam todos de uma vez no próximo acesso).
update public.orders
   set ads_conversion_sent_at = coalesce(paid_at, now())
 where status = 'paid' and ads_conversion_sent_at is null;
