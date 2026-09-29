-- CORREÇÃO: a garantia de 7 dias (SQL 30) não deve ligar sozinha.
-- Ela tinha vindo ATIVADA por padrão em todo produto, mesmo sem nenhuma aula marcada como "amostra" — na
-- prática, travava TODAS as aulas do curso pros primeiros 7 dias de quem acabou de comprar, sem você ter
-- decidido isso. Esta migração desliga a garantia nos produtos que já existem e muda o padrão para
-- desligado nos produtos novos também: agora só liga quem você ligar, produto por produto, em Produtos.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 30_garantia_7_dias.sql já executada).

update public.products set access_hold_enabled = false;

alter table public.products alter column access_hold_enabled set default false;
