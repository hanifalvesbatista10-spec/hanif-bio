-- HANIF ALVES V4 — CMS DO SITE
-- Execute no Supabase SQL Editor uma única vez.

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  hero_kicker text not null default 'APH • URGÊNCIA • EMERGÊNCIA',
  hero_title text not null default 'Domine situações críticas antes que elas aconteçam.',
  hero_subtitle text not null default 'Treinamentos, materiais e mentorias para profissionais e estudantes que querem tomar decisões com mais segurança no atendimento pré-hospitalar.',
  hero_primary_label text not null default 'Conhecer treinamentos',
  hero_secondary_label text not null default 'Ver produtos',
  hero_image_url text not null default '/assets/hanif-hero.png',
  authority_line text not null default '10 anos na linha de frente • SAMU 192 • Instrutor APH • Conteúdo baseado em evidências',
  about_title text not null default 'Experiência de linha de frente transformada em ensino aplicável.',
  about_text text not null default 'Conteúdo direto, didático e conectado à realidade do atendimento pré-hospitalar.',
  whatsapp_url text not null default 'https://wa.me/5588993765491',
  instagram_url text not null default '',
  footer_description text not null default 'Educação aplicada à tomada de decisão em situações críticas.',
  footer_disclaimer text not null default 'Conteúdo educacional. A aplicação prática deve respeitar protocolos, legislação e atribuições profissionais vigentes.',
  copyright_text text not null default '© 2026 Hanif Alves. Todos os direitos reservados.',
  updated_at timestamptz not null default now()
);

insert into public.site_settings(id) values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "admin manage site settings" on public.site_settings;
create policy "admin manage site settings"
on public.site_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.touch_site_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_updated on public.site_settings;
create trigger site_settings_updated
before update on public.site_settings
for each row execute function public.touch_site_settings_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.site_settings;
exception
  when duplicate_object then null;
end $$;
