-- HANIF ALVES — VENDA POR WHATSAPP (PRODUTO SEM PREÇO)
-- Novo modo de venda "whatsapp": o produto não tem preço fixo e o botão do site leva direto para
-- uma conversa no WhatsApp, em vez de abrir um checkout. Reaproveita a coluna whatsapp_url que já
-- existe em products desde o início do projeto. Execute no SQL Editor do Supabase.

alter table public.products drop constraint if exists products_checkout_mode_check;
alter table public.products
  add constraint products_checkout_mode_check check (checkout_mode in ('external', 'internal', 'whatsapp'));
