-- HANIF ALVES — CAPTAÇÃO DE LEADS NO RADAR DE EVIDÊNCIAS
-- Para abrir a análise completa do Radar, o visitante deixa nome, WhatsApp e e-mail (com consentimento). No fim da
-- leitura ele recebe o convite para a comunidade APH Hardcore (link guardado em site_settings.community_url).
--  * qualquer visitante só consegue INSERIR um lead; ninguém lê a lista além do administrador;
--  * o mesmo e-mail não entra duas vezes (índice único, sem diferenciar maiúsculas);
--  * cada lead novo avisa o dono no Telegram (usa public.notify_owner, SQL 43).
-- Execute no SQL Editor do Supabase.

alter table public.site_settings add column if not exists community_url text;

create table if not exists public.radar_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  source text not null default 'radar' check (source = 'radar'),
  radar_item_id uuid references public.radar_items(id) on delete set null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists radar_leads_email_unique on public.radar_leads (lower(email));
create index if not exists radar_leads_created_idx on public.radar_leads (created_at desc);

alter table public.radar_leads enable row level security;

drop policy if exists "radar leads public insert" on public.radar_leads;
create policy "radar leads public insert" on public.radar_leads
  for insert to anon, authenticated with check (source = 'radar');

drop policy if exists "radar leads admin" on public.radar_leads;
create policy "radar leads admin" on public.radar_leads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.alert_new_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_owner(format(E'Novo lead do Radar\n%s\nWhatsApp: %s\n%s', new.name, new.whatsapp, new.email));
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists alert_new_lead on public.radar_leads;
create trigger alert_new_lead after insert on public.radar_leads
for each row execute function public.alert_new_lead();
