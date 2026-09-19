-- CONTEÚDO GRATUITO, MATERIAIS, FAQ E SEO POR PRODUTO
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: nenhuma tabela é apagada ou recriada.

-- 1) SEO por produto (colunas novas, nulas por padrão — não afeta produtos existentes)
alter table public.products
  add column if not exists meta_title text,
  add column if not exists meta_description text;

-- 2) FAQ do site (perguntas frequentes exibidas na Home / seção pública de FAQ)
create table if not exists public.site_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  status public.content_status not null default 'draft',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_faqs_status_order_idx on public.site_faqs(status, display_order);

drop trigger if exists site_faqs_updated on public.site_faqs;
create trigger site_faqs_updated before update on public.site_faqs
for each row execute function public.set_updated_at();

alter table public.site_faqs enable row level security;

drop policy if exists "public published faqs" on public.site_faqs;
create policy "public published faqs"
on public.site_faqs for select
to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "admin faqs full" on public.site_faqs;
create policy "admin faqs full"
on public.site_faqs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.site_faqs;
exception
  when duplicate_object then null;
end $$;

-- 3) Conteúdos gratuitos e materiais para download
--    content_type = 'artigo'  -> conteúdo gratuito (texto/página)
--    content_type = 'material' -> material para download (usa download_url)
create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  body text,
  cover_url text,
  content_type text not null default 'artigo' check (content_type in ('artigo', 'material')),
  download_url text,
  status public.content_status not null default 'draft',
  display_order integer not null default 0,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_content_status_order_idx on public.site_content(status, content_type, display_order);

drop trigger if exists site_content_updated on public.site_content;
create trigger site_content_updated before update on public.site_content
for each row execute function public.set_updated_at();

alter table public.site_content enable row level security;

drop policy if exists "public published content" on public.site_content;
create policy "public published content"
on public.site_content for select
to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "admin content full" on public.site_content;
create policy "admin content full"
on public.site_content for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.site_content;
exception
  when duplicate_object then null;
end $$;

-- Bucket público para capas de conteúdo e arquivos de materiais (mesmo padrão do bucket "products").
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content',
  'site-content',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Arquivos publicos de conteudo" on storage.objects;
create policy "Arquivos publicos de conteudo"
on storage.objects for select
to public
using (bucket_id = 'site-content');

drop policy if exists "Admin envia arquivos de conteudo" on storage.objects;
create policy "Admin envia arquivos de conteudo"
on storage.objects for insert
to authenticated
with check (bucket_id = 'site-content' and public.is_admin());

drop policy if exists "Admin atualiza arquivos de conteudo" on storage.objects;
create policy "Admin atualiza arquivos de conteudo"
on storage.objects for update
to authenticated
using (bucket_id = 'site-content' and public.is_admin())
with check (bucket_id = 'site-content' and public.is_admin());

drop policy if exists "Admin exclui arquivos de conteudo" on storage.objects;
create policy "Admin exclui arquivos de conteudo"
on storage.objects for delete
to authenticated
using (bucket_id = 'site-content' and public.is_admin());

-- 4) Mentoria de APH como produto real e persistente (idempotente — não duplica se já existir)
insert into public.products (
  title, slug, subtitle, short_description, cover_url, category,
  price, promotional_price, checkout_url, whatsapp_url,
  status, is_featured, display_order
)
values (
  'Mentoria de APH',
  'mentoria-aph',
  'Preparação teórica e estratégica para estudantes e profissionais da saúde.',
  'Mentoria teórica de APH: emergências traumáticas, clínicas e psiquiátricas, afogamento e assuntos de urgência e emergência.',
  '/assets/mentoria-capa.png',
  'Mentoria',
  null,
  null,
  'https://pay.kiwify.com.br/ZvtGR1D',
  'https://wa.me/5588993765491',
  'active',
  true,
  0
)
on conflict (slug) do nothing;
