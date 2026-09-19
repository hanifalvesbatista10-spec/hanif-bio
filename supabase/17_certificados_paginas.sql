-- CERTIFICADOS — VÁRIAS PÁGINAS POR MODELO (certificado + verso + carteirinha...)
-- Cada modelo passa a ter uma lista de páginas (cada uma com sua arte, textos, imagens e foto).
-- Modelos antigos (1 página) continuam funcionando sem alteração.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (depende de 16_certificados.sql).

alter table public.certificate_templates
  add column if not exists pages jsonb not null default '[]'::jsonb;

-- A verificação pública passa a devolver também as páginas do modelo.
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
      'qr', t.qr,
      'pages', t.pages
    )
  )
  from public.certificates c
  join public.certificate_templates t on t.id = c.template_id
  where c.code = upper(btrim(p_code))
  limit 1;
$$;

grant execute on function public.get_certificate(text) to anon, authenticated;
