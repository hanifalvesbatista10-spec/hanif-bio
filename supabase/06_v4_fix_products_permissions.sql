-- HANIF ALVES V4 — CORREÇÃO DE GRAVAÇÃO DE PRODUTOS
-- Execute no SQL Editor do Supabase se o painel informar erro de permissão/RLS.

-- Garante privilégios básicos ao papel autenticado.
grant select, insert, update, delete on table public.products to authenticated;

-- Mantém leitura pública apenas para produtos ativos.
drop policy if exists "public active products" on public.products;
create policy "public active products"
on public.products
for select
to anon, authenticated
using (status = 'active' or public.is_admin());

-- Recria a política administrativa completa.
drop policy if exists "admin products full" on public.products;
create policy "admin products full"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Diagnóstico útil: deve retornar true quando executado em sessão autenticada do ADM via app.
-- select public.is_admin();
