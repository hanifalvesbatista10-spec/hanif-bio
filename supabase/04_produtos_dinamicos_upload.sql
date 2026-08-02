-- PRODUTOS DINÂMICOS COM UPLOAD DE IMAGEM
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.

-- Cria um bucket público para as imagens dos produtos.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'products',
  'products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Visitantes podem visualizar as imagens porque o bucket é público.
drop policy if exists "Imagens publicas dos produtos" on storage.objects;
create policy "Imagens publicas dos produtos"
on storage.objects
for select
to public
using (bucket_id = 'products');

-- Somente administradores podem enviar imagens.
drop policy if exists "Admin envia imagens de produtos" on storage.objects;
create policy "Admin envia imagens de produtos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'products'
  and public.is_admin()
);

-- Somente administradores podem substituir imagens.
drop policy if exists "Admin atualiza imagens de produtos" on storage.objects;
create policy "Admin atualiza imagens de produtos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'products'
  and public.is_admin()
)
with check (
  bucket_id = 'products'
  and public.is_admin()
);

-- Somente administradores podem excluir imagens.
drop policy if exists "Admin exclui imagens de produtos" on storage.objects;
create policy "Admin exclui imagens de produtos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'products'
  and public.is_admin()
);

-- Atualiza a página pública automaticamente quando produtos mudarem.
do $$
begin
  alter publication supabase_realtime add table public.products;
exception
  when duplicate_object then null;
end $$;
