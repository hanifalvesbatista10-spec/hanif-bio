-- HANIF ALVES — MATERIAL DA AULA (arquivo por aula, guardado no Cloudflare R2)
-- Cada aula pode ter um PDF próprio (apostila, slide etc.), além do arquivo do produto inteiro
-- (SQL 40). O arquivo em si fica no R2 (fora do Supabase): aqui só guardamos a referência (key) e
-- o nome original. Quem pode baixar é decidido pela mesma regra que já libera a aula (RLS da
-- própria tabela product_lessons via can_access_lesson/"students with access read lessons"),
-- conferida pela função /api/r2-sign-download. Execute no SQL Editor do Supabase.

alter table public.product_lessons
  add column if not exists attachment_file_path text,
  add column if not exists attachment_file_name text;
