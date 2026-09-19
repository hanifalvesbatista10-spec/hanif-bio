-- MUX COMO PLAYER DE VÍDEO PROTEGIDO NA ÁREA DE MEMBROS
-- Permite que cada aula use YouTube (como hoje) ou Mux (vídeo hospedado e protegido por
-- link assinado de curta duração). Aulas atuais continuam intactas como 'youtube'.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: só adiciona colunas e regras em product_lessons.

-- Aulas em Mux não têm link de vídeo público.
alter table public.product_lessons alter column video_url drop not null;

alter table public.product_lessons
  add column if not exists mux_upload_id text,
  add column if not exists mux_asset_id text,
  add column if not exists mux_playback_id text,
  add column if not exists mux_status text,
  add column if not exists duration_seconds integer;

alter table public.product_lessons drop constraint if exists product_lessons_provider_check;
alter table public.product_lessons
  add constraint product_lessons_provider_check check (video_provider in ('youtube', 'mux'));

alter table public.product_lessons drop constraint if exists product_lessons_mux_status_check;
alter table public.product_lessons
  add constraint product_lessons_mux_status_check
  check (mux_status is null or mux_status in ('uploading', 'processing', 'ready', 'errored'));

-- Cada aula precisa da sua fonte: link (YouTube) ou upload (Mux).
alter table public.product_lessons drop constraint if exists product_lessons_video_source_check;
alter table public.product_lessons
  add constraint product_lessons_video_source_check
  check (
    (video_provider = 'youtube' and video_url is not null and btrim(video_url) <> '')
    or (video_provider = 'mux' and mux_upload_id is not null)
  );

create index if not exists product_lessons_mux_asset_idx on public.product_lessons(mux_asset_id);
