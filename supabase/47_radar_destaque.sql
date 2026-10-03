-- HANIF ALVES — DESTAQUE DO RADAR DE EVIDÊNCIAS NA PÁGINA INICIAL
-- Permite marcar quais análises publicadas aparecem em destaque na página inicial e no topo da página do Radar.
-- Execute no SQL Editor do Supabase.

alter table public.radar_items add column if not exists featured boolean not null default false;
create index if not exists radar_items_featured_idx on public.radar_items (featured, published_at desc) where status = 'published';
