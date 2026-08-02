-- 1. Primeiro crie sua conta normalmente em /cadastro.
-- 2. Depois troque o e-mail abaixo pelo e-mail usado no cadastro.
-- 3. Execute este arquivo no SQL Editor do Supabase.

update public.profiles
set role = 'admin', account_status = 'active'
where email = 'COLOQUE_SEU_EMAIL_AQUI';
