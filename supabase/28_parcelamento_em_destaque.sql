-- PARCELAMENTO EM DESTAQUE NOS PREÇOS ("12x de R$ 27,90")
-- Guarda o número máximo de parcelas e o juro TOTAL que o comprador paga no cartão (repassado pela InfinitePay),
-- para o site mostrar o valor da parcela já com juros. Quem preenche é o admin, em Produtos.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 05_v4_site_settings.sql já executada).

-- nulo = destaque desligado. Ex.: 18.40 significa que 12x custa 18,40% a mais que o preço à vista.
alter table public.site_settings add column if not exists installments_fee_percent numeric(6, 2);
alter table public.site_settings add column if not exists installments_max integer not null default 12;

alter table public.site_settings drop constraint if exists site_settings_installments_fee_range;
alter table public.site_settings add constraint site_settings_installments_fee_range
  check (installments_fee_percent is null or (installments_fee_percent >= 0 and installments_fee_percent <= 60));

alter table public.site_settings drop constraint if exists site_settings_installments_max_range;
alter table public.site_settings add constraint site_settings_installments_max_range
  check (installments_max between 2 and 12);
