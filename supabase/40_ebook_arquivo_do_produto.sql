-- HANIF ALVES — ARQUIVO DE E-BOOK NO PRODUTO (download na área de membros)
-- Produto ganha um arquivo (PDF) opcional. Guardado num bucket PRIVADO: ninguém baixa
-- direto pelo link, só quem comprou (user_products ativo) ou o admin, via link temporário
-- gerado na hora (createSignedUrl). Execute no SQL Editor do Supabase.

alter table public.products
  add column if not exists ebook_file_path text,
  add column if not exists ebook_file_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-files', 'product-files', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

drop policy if exists "admin manage product files" on storage.objects;
create policy "admin manage product files"
on storage.objects for all to authenticated
using (bucket_id = 'product-files' and public.is_admin())
with check (bucket_id = 'product-files' and public.is_admin());

-- Quem comprou o produto (acesso ativo) pode gerar o link temporário de download do arquivo
-- daquele produto especificamente — nunca de outro arquivo do mesmo bucket.
drop policy if exists "buyers read own ebook file" on storage.objects;
create policy "buyers read own ebook file"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-files'
  and exists (
    select 1
      from public.user_products up
      join public.products p on p.id = up.product_id
     where up.user_id = auth.uid()
       and up.access_status = 'active'
       and p.ebook_file_path = storage.objects.name
  )
);
