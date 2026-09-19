-- CERTIFICADOS — MODELOS A PARTIR DE ARTE PRONTA, EMISSÃO INDIVIDUAL E EM MASSA
-- Cria: bucket das artes de fundo, modelos (posição/estilo dos textos), certificados emitidos
-- (com código de verificação) e a função pública de verificação por código.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: só cria objetos novos.

-- 1) Bucket público para as artes de fundo (imagens PNG/JPG/WebP até 15 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-backgrounds', 'certificate-backgrounds', true, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Artes de certificado publicas" on storage.objects;
create policy "Artes de certificado publicas"
on storage.objects for select to public
using (bucket_id = 'certificate-backgrounds');

drop policy if exists "Admin envia artes de certificado" on storage.objects;
create policy "Admin envia artes de certificado"
on storage.objects for insert to authenticated
with check (bucket_id = 'certificate-backgrounds' and public.is_admin());

drop policy if exists "Admin atualiza artes de certificado" on storage.objects;
create policy "Admin atualiza artes de certificado"
on storage.objects for update to authenticated
using (bucket_id = 'certificate-backgrounds' and public.is_admin())
with check (bucket_id = 'certificate-backgrounds' and public.is_admin());

drop policy if exists "Admin exclui artes de certificado" on storage.objects;
create policy "Admin exclui artes de certificado"
on storage.objects for delete to authenticated
using (bucket_id = 'certificate-backgrounds' and public.is_admin());

-- 2) Código de verificação (ex.: HA-3F9A1-C07BE), difícil de adivinhar
create or replace function public.gen_certificate_code()
returns text language sql volatile as $$
  select 'HA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))
              || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
$$;

-- 3) Modelos: arte de fundo + textos posicionados (blocks) + QR opcional
create table if not exists public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  background_url text not null,
  background_path text,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  blocks jsonb not null default '[]'::jsonb,
  qr jsonb not null default '{"enabled": false, "x": 91, "y": 86, "size": 9}'::jsonb,
  defaults jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists certificate_templates_updated on public.certificate_templates;
create trigger certificate_templates_updated before update on public.certificate_templates
for each row execute function public.set_updated_at();

-- 4) Certificados emitidos
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.gen_certificate_code(),
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  recipient_name text not null check (char_length(btrim(recipient_name)) >= 2),
  recipient_email text,
  user_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  batch_label text,
  status text not null default 'valid' check (status in ('valid', 'revoked')),
  issued_at timestamptz not null default now(),
  issued_by uuid default auth.uid() references public.profiles(id) on delete set null
);

create index if not exists certificates_template_idx on public.certificates(template_id, issued_at desc);
create index if not exists certificates_email_idx on public.certificates(lower(recipient_email));
create index if not exists certificates_batch_idx on public.certificates(batch_label);

-- Se já existe aluno com esse e-mail, vincula o certificado à conta dele.
create or replace function public.certificates_link_user()
returns trigger security definer set search_path = public language plpgsql as $$
begin
  if new.user_id is null and new.recipient_email is not null then
    select id into new.user_id from public.profiles
    where lower(email) = lower(new.recipient_email) limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists certificates_link_user on public.certificates;
create trigger certificates_link_user before insert on public.certificates
for each row execute function public.certificates_link_user();

-- 5) RLS
alter table public.certificate_templates enable row level security;
alter table public.certificates enable row level security;

drop policy if exists "admin certificate templates full" on public.certificate_templates;
create policy "admin certificate templates full"
on public.certificate_templates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin certificates full" on public.certificates;
create policy "admin certificates full"
on public.certificates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Aluno vê os PRÓPRIOS certificados válidos (pela conta ou pelo e-mail do cadastro).
drop policy if exists "students read own certificates" on public.certificates;
create policy "students read own certificates"
on public.certificates for select to authenticated
using (
  status = 'valid'
  and (user_id = auth.uid() or lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
);

-- ...e o modelo necessário para desenhar esses certificados.
drop policy if exists "students read templates of own certificates" on public.certificate_templates;
create policy "students read templates of own certificates"
on public.certificate_templates for select to authenticated
using (
  exists (
    select 1 from public.certificates c
    where c.template_id = certificate_templates.id
      and c.status = 'valid'
      and (c.user_id = auth.uid() or lower(c.recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

-- 6) Verificação pública: quem tem o código consegue conferir e baixar (ninguém lista nada).
create or replace function public.get_certificate(p_code text)
returns jsonb stable security definer set search_path = public language sql as $$
  select jsonb_build_object(
    'code', c.code,
    'status', c.status,
    'recipient_name', c.recipient_name,
    'data', c.data,
    'issued_at', c.issued_at,
    'template', jsonb_build_object(
      'name', t.name,
      'background_url', t.background_url,
      'width', t.width,
      'height', t.height,
      'blocks', t.blocks,
      'qr', t.qr
    )
  )
  from public.certificates c
  join public.certificate_templates t on t.id = c.template_id
  where c.code = upper(btrim(p_code))
  limit 1;
$$;

grant execute on function public.get_certificate(text) to anon, authenticated;
