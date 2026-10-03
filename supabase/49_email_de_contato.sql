-- HANIF ALVES — E-MAIL DE CONTATO DO SITE
-- Guarda o e-mail de contato mostrado na política de privacidade (quem é o responsável e como exercer os direitos da LGPD).
-- O valor é editado em Admin > Conteúdo do site. Execute no SQL Editor do Supabase.

alter table public.site_settings add column if not exists contact_email text;
