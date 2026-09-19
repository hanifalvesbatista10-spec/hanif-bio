-- EVENTOS — CRIAR VÁRIOS EVENTOS, CADA UM COM LINK DE INSCRIÇÃO E RESULTADOS PRÓPRIOS
-- Antes só existia um evento fixo (Aulão APH Barro-CE). Agora cada evento é um registro em
-- public.events e tem página pública em /evento/<slug>. As inscrições continuam na tabela
-- public.event_registrations (coluna event_slug) — as já existentes NÃO são alteradas.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva.

-- 1) Tabela de eventos
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  kicker text,
  headline text,
  subtitle text,
  tags text[] not null default '{}',
  info jsonb not null default '[]'::jsonb,
  section_title text,
  description text,
  topics jsonb not null default '[]'::jsonb,
  form_title text,
  form_intro text,
  cta_label text,
  ask_fields jsonb not null default '{"city":true,"occupation":true,"aph_experience":true,"main_goal":true}'::jsonb,
  success_title text,
  success_message text,
  whatsapp_group_url text,
  capacity integer check (capacity is null or capacity > 0),
  registration_deadline timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists events_updated on public.events;
create trigger events_updated before update on public.events
for each row execute function public.set_updated_at();

alter table public.events enable row level security;

-- Público lê eventos publicados ou encerrados (para mostrar "inscrições encerradas").
drop policy if exists "public read events" on public.events;
create policy "public read events"
on public.events for select
to anon, authenticated
using (status in ('published', 'closed') or public.is_admin());

drop policy if exists "admin events full" on public.events;
create policy "admin events full"
on public.events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on table public.events to anon, authenticated;
grant insert, update, delete on table public.events to authenticated;

-- 2) Evento que já existia (mantém as inscrições e o link atuais funcionando)
insert into public.events (
  slug, title, kicker, headline, subtitle, tags, info, section_title, description, topics,
  form_title, form_intro, cta_label, success_title, success_message, whatsapp_group_url, status
) values (
  'aulao-aph-barro-2026',
  'Aulão APH — Barro-CE',
  'AULÃO GRATUITO EM',
  'BARRO–CE',
  'CURSO INTENSIVO DE *ATENDIMENTO PRÉ-HOSPITALAR*',
  array['CLÍNICO', 'TRAUMA', 'TEORIA + PRÁTICA', '100% GRATUITO'],
  '[{"title":"EM BREVE","text":"Data será divulgada aos inscritos"},{"title":"BARRO–CE","text":"Local será informado aos inscritos"},{"title":"VAGAS LIMITADAS","text":"Inscrição gratuita"}]'::jsonb,
  'Atualização para quem quer decidir melhor no APH.',
  'O aulão foi pensado para profissionais, estudantes e interessados em atendimento pré-hospitalar que desejam revisar conceitos e fortalecer a tomada de decisão diante de situações clínicas e traumáticas.',
  '[{"title":"Atendimento clínico","text":"Reconhecimento, avaliação e prioridades iniciais."},{"title":"Atendimento ao trauma","text":"Abordagem, prioridades e tomada de decisão."},{"title":"Conteúdo aplicado","text":"Foco na realidade do atendimento pré-hospitalar."},{"title":"Barro–CE","text":"Data e local serão divulgados aos inscritos."}]'::jsonb,
  'Faça sua inscrição gratuita',
  'Preencha seus dados para garantir sua inscrição e receber as próximas informações.',
  'GARANTIR MINHA INSCRIÇÃO GRATUITA',
  'Inscrição confirmada.',
  'Você está inscrito no Aulão Intensivo de Atendimento Pré-Hospitalar — Clínico + Trauma, em Barro–CE. Entre agora no grupo oficial para receber data, local e orientações do evento.',
  'https://chat.whatsapp.com/H8wFKHIVebYIH2tOU80wNU?s=cl&p=a&mlu=4&ilr=4',
  'published'
)
on conflict (slug) do nothing;

-- 3) A inscrição pública passa a valer para QUALQUER evento publicado, dentro do prazo e com vaga.
create or replace function public.event_accepts_registrations(target_slug text)
returns boolean stable security definer set search_path = public language sql as $$
  select exists (
    select 1
    from public.events e
    where e.slug = target_slug
      and e.status = 'published'
      and (e.registration_deadline is null or e.registration_deadline > now())
      and (
        e.capacity is null
        or (select count(*) from public.event_registrations r where r.event_slug = e.slug) < e.capacity
      )
  );
$$;

grant execute on function public.event_accepts_registrations(text) to anon, authenticated;

drop policy if exists "public event registration insert" on public.event_registrations;
create policy "public event registration insert"
on public.event_registrations
for insert
to anon, authenticated
with check (
  public.event_accepts_registrations(event_slug)
  and length(trim(full_name)) >= 2
  and length(trim(whatsapp)) >= 8
  and position('@' in email) > 1
);
