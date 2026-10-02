-- HANIF ALVES — CORRIGE O STATUS "OCULTO" (UNLISTED) QUE NUNCA FUNCIONOU DE VERDADE
-- O status de produtos é um ENUM do Postgres (public.product_status), criado em 01_setup_completo.sql
-- só com os valores 'draft','active','inactive','archived'. A migração 37 (produto oculto por link)
-- mudou a política de leitura pública para aceitar 'unlisted', mas nunca adicionou esse valor ao enum —
-- então qualquer comparação ou gravação com status='unlisted' falha com
-- "invalid input value for enum product_status: unlisted". Isso também derrubava o filtro de bump do
-- checkout (que exclui produtos não públicos), por isso foi pego agora.
-- Execute no SQL Editor do Supabase.

alter type public.product_status add value if not exists 'unlisted';
