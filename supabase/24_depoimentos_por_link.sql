-- DEPOIMENTOS POR LINK
-- Você cria um link no painel (Feedbacks > Pedir depoimento), manda para o aluno, ele preenche
-- (nome, nota, depoimento, foto...) e o texto chega em "Em análise". Nada vai ao site sem você publicar.
--  * Link geral: vale para várias pessoas (ex.: "Turma de outubro"). Link pessoal: com o nome do aluno, vale 1 vez.
--  * O link pode ter validade e limite de usos, e pode ser desligado a qualquer momento.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- 1) Links
create table if not exists public.feedback_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  label text,
  product_id uuid references public.products(id) on delete set null,
  student_id uuid references public.profiles(id) on delete set null,
  student_name text,
  max_uses integer check (max_uses is null or max_uses >= 1),
  uses integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.feedback_links enable row level security;
drop policy if exists "admin feedback links full" on public.feedback_links;
create policy "admin feedback links full"
on public.feedback_links for all to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.feedback_links from anon;
grant all on public.feedback_links to authenticated;

-- 2) Origem do feedback
alter table public.student_feedbacks
  add column if not exists source text not null default 'admin',
  add column if not exists link_id uuid references public.feedback_links(id) on delete set null;

alter table public.student_feedbacks drop constraint if exists student_feedbacks_source_check;
alter table public.student_feedbacks add constraint student_feedbacks_source_check check (source in ('admin', 'link'));

-- 3) Fotos enviadas pelo aluno (limite de tamanho e tipo no próprio bucket)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-photos', 'feedback-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- o caminho da foto precisa conter o código de um link ativo: pending/<código>/<arquivo>
create or replace function public.feedback_upload_allowed(p_name text)
returns boolean
stable
security definer
set search_path = public
language sql
as $$
  select exists (
    select 1 from public.feedback_links l
    where l.active
      and (l.expires_at is null or l.expires_at > now())
      and p_name like 'pending/' || l.token || '/%'
  );
$$;
grant execute on function public.feedback_upload_allowed(text) to anon, authenticated;

drop policy if exists "feedback photos public read" on storage.objects;
create policy "feedback photos public read"
on storage.objects for select to public
using (bucket_id = 'feedback-photos');

drop policy if exists "feedback photos upload with link" on storage.objects;
create policy "feedback photos upload with link"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'feedback-photos' and public.feedback_upload_allowed(name));

drop policy if exists "feedback photos admin manage" on storage.objects;
create policy "feedback photos admin manage"
on storage.objects for all to authenticated
using (bucket_id = 'feedback-photos' and public.is_admin())
with check (bucket_id = 'feedback-photos' and public.is_admin());

-- 4) O que a página pública precisa saber sobre o link (sem expor mais nada)
create or replace function public.feedback_link_info(p_token text)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  l public.feedback_links;
  v_product text;
begin
  select * into l from public.feedback_links where token = p_token;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if not l.active then
    return jsonb_build_object('valid', false, 'reason', 'inactive');
  end if;
  if l.expires_at is not null and l.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if l.max_uses is not null and l.uses >= l.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'used');
  end if;
  select title into v_product from public.products where id = l.product_id;
  return jsonb_build_object(
    'valid', true,
    'label', l.label,
    'product_title', v_product,
    'student_name', l.student_name
  );
end;
$$;

-- 5) Envio do depoimento pelo aluno (sempre entra "Em análise")
create or replace function public.submit_feedback_via_link(p_token text, p_data jsonb)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  l public.feedback_links;
  v_name text := trim(coalesce(p_data ->> 'name', ''));
  v_text text := trim(coalesce(p_data ->> 'testimonial', ''));
  v_rating integer;
  v_photo text := nullif(trim(coalesce(p_data ->> 'photo', '')), '');
  v_media text := nullif(trim(coalesce(p_data ->> 'media_url', '')), '');
begin
  select * into l from public.feedback_links where token = p_token for update;
  if not found or not l.active then
    raise exception 'Este link não está mais disponível.';
  end if;
  if l.expires_at is not null and l.expires_at < now() then
    raise exception 'Este link venceu. Peça um novo para quem enviou.';
  end if;
  if l.max_uses is not null and l.uses >= l.max_uses then
    raise exception 'Este link já foi usado.';
  end if;

  -- campo escondido que só robôs preenchem: finge que deu certo e não grava nada
  if coalesce(p_data ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe o seu nome.';
  end if;
  if char_length(v_text) < 20 then
    raise exception 'Conte um pouco mais sobre a sua experiência (mínimo de 20 letras).';
  end if;
  if char_length(v_text) > 2500 then
    raise exception 'O depoimento passou de 2500 letras. Resuma um pouco.';
  end if;

  begin
    v_rating := (p_data ->> 'rating')::integer;
  exception when others then
    v_rating := 5;
  end;
  if v_rating is null or v_rating < 1 or v_rating > 5 then
    v_rating := 5;
  end if;

  if v_photo is not null and (v_photo not like '%/feedback-photos/pending/' || l.token || '/%' or char_length(v_photo) > 600) then
    v_photo := null;
  end if;
  if v_media is not null and (v_media !~* '^https?://' or char_length(v_media) > 500) then
    v_media := null;
  end if;

  insert into public.student_feedbacks (
    student_id, student_name, student_photo, profession, product_id, title, testimonial, rating,
    institution, city, result_achieved, media_url, status, publication_authorized, source, link_id
  ) values (
    l.student_id,
    left(v_name, 120),
    v_photo,
    left(nullif(trim(coalesce(p_data ->> 'profession', '')), ''), 120),
    l.product_id,
    left(nullif(trim(coalesce(p_data ->> 'title', '')), ''), 140),
    v_text,
    v_rating,
    left(nullif(trim(coalesce(p_data ->> 'institution', '')), ''), 120),
    left(nullif(trim(coalesce(p_data ->> 'city', '')), ''), 80),
    left(nullif(trim(coalesce(p_data ->> 'result_achieved', '')), ''), 800),
    v_media,
    'review',
    coalesce((p_data ->> 'authorized')::boolean, false),
    'link',
    l.id
  );

  update public.feedback_links set uses = uses + 1 where id = l.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.feedback_link_info(text) from public;
revoke all on function public.submit_feedback_via_link(text, jsonb) from public;
grant execute on function public.feedback_link_info(text) to anon, authenticated;
grant execute on function public.submit_feedback_via_link(text, jsonb) to anon, authenticated;
