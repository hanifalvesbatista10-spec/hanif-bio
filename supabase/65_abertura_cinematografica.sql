-- HANIF ALVES — ABERTURA CINEMATOGRÁFICA DA HOME (textos e mídia editáveis)
-- O que faz:
--  1) site_settings.cinematic (jsonb, opcional): textos, botões, destinos e imagens da abertura da home
--     (4 momentos guiados pela rolagem) e a chave que liga/desliga a cena.
--     Chaves usadas (todas opcionais; vazio ou ausente = padrão do código, em src/components/cinematic/config.js):
--       enabled (boolean; false = volta para a abertura simples antiga), kicker,
--       title1, support1, primary_label, primary_href, secondary_label, secondary_href,
--       title2, support2, title3, support3, title4, support4, cta4_label, cta4_href,
--       opening_desktop, opening_mobile, prep_mobile, training_desktop, training_mobile (URLs de imagem).
--     Nos títulos, o trecho entre **asteriscos** sai em vermelho.
-- Não mexe em nenhuma linha existente (a coluna nasce nula) e não muda as regras de acesso: a leitura pública e a edição só do
-- administrador continuam sendo as da própria tabela site_settings. Sem esta migration a home usa os textos padrão.
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez.

alter table public.site_settings add column if not exists cinematic jsonb;

alter table public.site_settings drop constraint if exists site_settings_cinematic_object;
alter table public.site_settings
  add constraint site_settings_cinematic_object check (cinematic is null or jsonb_typeof(cinematic) = 'object');
