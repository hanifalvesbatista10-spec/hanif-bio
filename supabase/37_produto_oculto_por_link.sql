-- HANIF ALVES — PRODUTO OCULTO POR LINK
-- Novo status de produto "unlisted": não aparece no catálogo do site, mas a página do produto e o
-- checkout continuam funcionando normalmente para quem tem o link direto.
-- Execute no SQL Editor do Supabase.

drop policy if exists "public active products" on public.products;
create policy "public active products"
on public.products
for select
to anon, authenticated
using (status in ('active', 'unlisted') or public.is_admin());
