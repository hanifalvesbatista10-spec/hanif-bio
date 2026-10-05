-- HANIF ALVES — RASTREAMENTO DA META (PIXEL + API DE CONVERSÕES)
-- Guarda no pedido o que a API de Conversões precisa para enviar a compra à Meta depois, quando o webhook de pagamento
-- roda (sem navegador): cookies _fbp/_fbc, IP, navegador e a página do checkout. Esses dados só são gravados quando o
-- comprador aceitou os cookies de anúncios (meta_consent = true). meta_capi_sent_at garante UM envio por pedido;
-- meta_capi_error guarda o motivo se a Meta recusar. Execute no SQL Editor do Supabase.

alter table public.orders
  add column if not exists meta_fbp text,
  add column if not exists meta_fbc text,
  add column if not exists meta_client_ip text,
  add column if not exists meta_user_agent text,
  add column if not exists meta_event_url text,
  add column if not exists meta_consent boolean not null default false,
  add column if not exists meta_capi_sent_at timestamptz,
  add column if not exists meta_capi_error text;
