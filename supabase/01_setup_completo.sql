-- HANIF ALVES BIO — FUNDAÇÃO SEGURA DO BANCO
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','student','user');
create type public.account_status as enum ('active','blocked','inactive');
create type public.content_status as enum ('draft','review','published','hidden','archived');
create type public.analysis_visibility as enum ('admin_only','student_and_admin','public','archived');
create type public.product_status as enum ('draft','active','inactive','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  phone text,
  role public.user_role not null default 'student',
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_access timestamptz
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  subtitle text,
  short_description text,
  full_description text,
  cover_url text,
  category text,
  price numeric(10,2),
  promotional_price numeric(10,2),
  benefits jsonb not null default '[]'::jsonb,
  target_audience jsonb not null default '[]'::jsonb,
  problems_solved jsonb not null default '[]'::jsonb,
  curriculum jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  checkout_url text,
  whatsapp_url text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_feedbacks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete set null,
  student_name text not null,
  student_photo text,
  profession text,
  product_id uuid references public.products(id) on delete set null,
  title text,
  testimonial text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  testimonial_date date not null default current_date,
  institution text,
  city text,
  result_achieved text,
  media_url text,
  status public.content_status not null default 'draft',
  is_featured boolean not null default false,
  is_verified boolean not null default false,
  publication_authorized boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_analyses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  analysis_date date not null default current_date,
  title text not null,
  analysis_text text,
  strengths text,
  improvements text,
  evolution text,
  recommendations text,
  next_steps text,
  rating numeric(4,2),
  performance_level text,
  visibility public.analysis_visibility not null default 'admin_only',
  internal_notes text,
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysis_attachments (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.student_analyses(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  access_status text not null default 'active',
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create index profiles_role_idx on public.profiles(role);
create index profiles_status_idx on public.profiles(account_status);
create index feedback_status_idx on public.student_feedbacks(status, publication_authorized);
create index analyses_student_idx on public.student_analyses(student_id, visibility);
create index products_status_order_idx on public.products(status, display_order);
create index logs_created_idx on public.activity_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger feedbacks_updated before update on public.student_feedbacks for each row execute function public.set_updated_at();
create trigger analyses_updated before update on public.student_analyses for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger security definer set search_path = public language plpgsql as $$
begin
  insert into public.profiles(id,full_name,email,role,account_status)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''),'student','active');
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean stable security definer set search_path = public language sql as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and account_status='active');
$$;

create or replace function public.is_active_user()
returns boolean stable security definer set search_path = public language sql as $$
  select exists(select 1 from public.profiles where id=auth.uid() and account_status='active');
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_active_user() to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.student_feedbacks enable row level security;
alter table public.student_analyses enable row level security;
alter table public.analysis_attachments enable row level security;
alter table public.activity_logs enable row level security;
alter table public.user_products enable row level security;

create policy "profile own read" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "profile own update safe" on public.profiles for update to authenticated using (id=auth.uid() and public.is_active_user()) with check (id=auth.uid());
create policy "admin profiles full" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public active products" on public.products for select to anon, authenticated using (status='active' or public.is_admin());
create policy "admin products full" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public published feedbacks" on public.student_feedbacks for select to anon, authenticated using ((status='published' and publication_authorized=true) or public.is_admin() or student_id=auth.uid());
create policy "student submit own feedback" on public.student_feedbacks for insert to authenticated with check (student_id=auth.uid() and status in ('draft','review'));
create policy "admin feedbacks full" on public.student_feedbacks for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "student own released analyses" on public.student_analyses for select to authenticated using (public.is_admin() or (student_id=auth.uid() and visibility='student_and_admin') or visibility='public');
create policy "admin analyses full" on public.student_analyses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "attachments according analysis" on public.analysis_attachments for select to authenticated using (exists(select 1 from public.student_analyses a where a.id=analysis_id and (public.is_admin() or (a.student_id=auth.uid() and a.visibility='student_and_admin') or a.visibility='public')));
create policy "admin attachments full" on public.analysis_attachments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin logs only" on public.activity_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "user products own read" on public.user_products for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "admin user products full" on public.user_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.products(title,slug,short_description,cover_url,category,checkout_url,whatsapp_url,status,is_featured,display_order)
values
('Mentoria APH','mentoria-aph','Preparação teórica e estratégica para estudantes e profissionais da saúde.','/assets/mentoria-aph.png','Mentoria',null,'https://wa.me/5588993765491','active',true,1),
('Controle de Hemorragias e Imobilizações','controle-de-hemorragias','E-book digital com conteúdo objetivo e fundamentado.','/assets/ebook-hemorragias.png','E-book','https://pay.hotmart.com/C106390978R?checkoutMode=2','https://wa.me/5588993765491','active',true,2),
('Comunidade APH','comunidade-aph','Comunidade para atualização e conexão profissional.','/assets/comunidade-aph.png','Comunidade','https://chat.whatsapp.com/BkIqczjJ3Uv2AitaIRp4q4','https://wa.me/5588993765491','active',true,3)
on conflict(slug) do nothing;
