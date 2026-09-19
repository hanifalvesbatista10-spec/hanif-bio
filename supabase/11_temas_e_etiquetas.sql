-- TEMA/DATA NOS CONTEÚDOS GRATUITOS E ETIQUETAS NOS PRODUTOS
-- (formato, duração, disponibilidade) — organização inspirada no padrão do
-- Aeromédico Brasil, preenchida com informações reais cadastradas pelo painel.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: apenas colunas novas, nulas por
-- padrão — nada muda visualmente até o administrador preencher algo.

alter table public.site_content
  add column if not exists category text,
  add column if not exists published_at date not null default current_date;

alter table public.products
  add column if not exists format text,
  add column if not exists duration text,
  add column if not exists availability_status text;
