-- AULÃO BARRO — INSCRIÇÕES / CAPTURA DE LEADS
-- Execute este arquivo no SQL Editor do Supabase.
-- Pode ser executado mesmo se a tabela já tiver sido criada manualmente.

create extension if not exists pgcrypto;

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  full_name text not null,
  whatsapp text not null,
  email text not null,
  city text,
  occupation text,
  aph_experience text,
  main_goal text,
  source text not null default 'bio',
  created_at timestamptz not null default now()
);

-- Garante as colunas usadas pelo formulário mesmo caso a tabela tenha sido criada antes.
alter table public.event_registrations add column if not exists event_slug text;
alter table public.event_registrations add column if not exists full_name text;
alter table public.event_registrations add column if not exists whatsapp text;
alter table public.event_registrations add column if not exists email text;
alter table public.event_registrations add column if not exists city text;
alter table public.event_registrations add column if not exists occupation text;
alter table public.event_registrations add column if not exists aph_experience text;
alter table public.event_registrations add column if not exists main_goal text;
alter table public.event_registrations add column if not exists source text default 'bio';
alter table public.event_registrations add column if not exists created_at timestamptz default now();

create index if not exists event_registrations_event_idx
  on public.event_registrations(event_slug, created_at desc);

-- Evita a mesma pessoa se cadastrar várias vezes no mesmo evento pelo mesmo e-mail.
create unique index if not exists event_registrations_event_email_unique
  on public.event_registrations(event_slug, lower(email));

alter table public.event_registrations enable row level security;

-- Privilégios necessários para o formulário público e para o ADM.
grant insert on table public.event_registrations to anon, authenticated;
grant select on table public.event_registrations to authenticated;

-- Público pode APENAS inserir inscrições. Não pode listar os leads.
drop policy if exists "public event registration insert" on public.event_registrations;
create policy "public event registration insert"
on public.event_registrations
for insert
to anon, authenticated
with check (
  event_slug = 'aulao-aph-barro-2026'
  and length(trim(full_name)) >= 2
  and length(trim(whatsapp)) >= 8
  and position('@' in email) > 1
);

-- Somente o administrador autenticado pode visualizar a lista de inscritos.
drop policy if exists "admin event registrations read" on public.event_registrations;
create policy "admin event registrations read"
on public.event_registrations
for select
to authenticated
using (public.is_admin());

-- Caso futuramente o ADM precise corrigir/excluir inscrições.
grant update, delete on table public.event_registrations to authenticated;

drop policy if exists "admin event registrations manage" on public.event_registrations;
create policy "admin event registrations manage"
on public.event_registrations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin event registrations delete" on public.event_registrations;
create policy "admin event registrations delete"
on public.event_registrations
for delete
to authenticated
using (public.is_admin());
