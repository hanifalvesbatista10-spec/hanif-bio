-- COMISSÃO PROGRESSIVA DE AFILIADOS E PAINEL DO AFILIADO
-- Regras: comissão base 10%; sobe para 15% a partir da 5ª venda paga do mês e para 20% a partir da 10ª
-- (a faixa vale só da venda que bateu a meta em diante, não mexe nas comissões já calculadas antes). O
-- código do afiliado continua um só, fixo. Se o afiliado tiver uma comissão própria definida (em Afiliados),
-- ela sempre vale no lugar da faixa progressiva. Mês = mês corrente (reinicia a contagem todo dia 1).
-- Também cria o painel do afiliado sem senha (e-mail + código) e um valor mínimo para pagamento (só aviso).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 34_afiliados.sql já executada).

alter table public.affiliate_settings add column if not exists tier2_threshold integer default 5;
alter table public.affiliate_settings add column if not exists tier2_percent numeric(5,2) default 15;
alter table public.affiliate_settings add column if not exists tier3_threshold integer default 10;
alter table public.affiliate_settings add column if not exists tier3_percent numeric(5,2) default 20;
alter table public.affiliate_settings add column if not exists minimum_payout_cents integer not null default 5000;
alter table public.affiliate_settings add column if not exists materials_url text;

-- Painel do afiliado: sem senha, confere e-mail + código do cupom dele e devolve só os números dele.
create or replace function public.affiliate_portal(p_email text, p_code text)
returns table (
  full_name text,
  status text,
  current_percent numeric,
  sales_this_month integer,
  owed_cents integer,
  paid_cents integer,
  next_tier_sales integer,
  next_tier_percent numeric,
  materials_url text
)
language sql
stable
security definer
set search_path = public
as $$
  with match as (
    select a.id, a.full_name, a.status, a.commission_percent
    from public.affiliates a
    join public.coupons c on c.affiliate_id = a.id
    where lower(a.email) = lower(trim(p_email)) and upper(c.code) = upper(trim(p_code))
    limit 1
  ),
  settings as (
    select * from public.affiliate_settings where id = 1
  ),
  counts as (
    select
      m.id,
      count(ac.*) filter (where ac.status <> 'void' and ac.created_at >= date_trunc('month', now())) as sales_this_month,
      coalesce(sum(ac.amount_cents) filter (where ac.status = 'owed'), 0) as owed_cents,
      coalesce(sum(ac.amount_cents) filter (where ac.status = 'paid'), 0) as paid_cents
    from match m
    left join public.affiliate_commissions ac on ac.affiliate_id = m.id
    group by m.id
  )
  select
    m.full_name,
    m.status,
    coalesce(
      m.commission_percent,
      case
        when s.tier3_threshold is not null and c.sales_this_month >= s.tier3_threshold then s.tier3_percent
        when s.tier2_threshold is not null and c.sales_this_month >= s.tier2_threshold then s.tier2_percent
        else s.default_commission_percent
      end
    ) as current_percent,
    c.sales_this_month::integer,
    c.owed_cents::integer,
    c.paid_cents::integer,
    case
      when m.commission_percent is not null then null
      when s.tier2_threshold is not null and c.sales_this_month < s.tier2_threshold then s.tier2_threshold - c.sales_this_month
      when s.tier3_threshold is not null and c.sales_this_month < s.tier3_threshold then s.tier3_threshold - c.sales_this_month
      else null
    end as next_tier_sales,
    case
      when m.commission_percent is not null then null
      when s.tier2_threshold is not null and c.sales_this_month < s.tier2_threshold then s.tier2_percent
      when s.tier3_threshold is not null and c.sales_this_month < s.tier3_threshold then s.tier3_percent
      else null
    end as next_tier_percent,
    s.materials_url
  from match m, settings s, counts c
  where c.id = m.id
$$;

revoke all on function public.affiliate_portal(text, text) from public;
grant execute on function public.affiliate_portal(text, text) to anon, authenticated;
