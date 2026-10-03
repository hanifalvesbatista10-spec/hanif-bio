-- HANIF ALVES — RADAR SEMANAL DE EVIDÊNCIAS (APH E URGÊNCIA/EMERGÊNCIA)
-- Coleta novas publicações toda sexta-feira (PubMed, ILCOR, NAEMSP), resume com IA e salva como RASCUNHO para
-- revisão em Conteúdos e materiais. Nada aparece no site sem a sua aprovação e publicação.
--
-- Segurança dentro do próprio banco (não depende do código):
--  * visitantes só leem itens com status "published";
--  * rascunhos, textos brutos coletados e orientações internas ficam em tabelas só do administrador;
--  * a automação (chave de serviço, sem usuário logado) NÃO consegue aprovar, publicar nem alterar conteúdo
--    já aprovado; só uma revisão humana faz isso, e o revisor/a data ficam gravados pelo banco;
--  * só pode haver UMA execução em andamento por vez.
-- Execute no SQL Editor do Supabase.

drop table if exists public.weekly_update_settings;

-- 1) Configuração
create table if not exists public.radar_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  first_window_days integer not null default 30 check (first_window_days between 1 and 120),
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.radar_settings (id) values (1) on conflict (id) do nothing;

-- 2) Histórico de execuções (e trava contra execuções simultâneas)
create table if not exists public.radar_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron', 'manual')),
  status text not null default 'running' check (status in ('running', 'ok', 'no_news', 'partial', 'error')),
  since_date date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  found integer not null default 0,
  new_items integer not null default 0,
  selected integer not null default 0,
  analyzed integer not null default 0,
  message text,
  error text
);
create unique index if not exists radar_runs_one_running on public.radar_runs ((true)) where status = 'running';
create index if not exists radar_runs_started_idx on public.radar_runs (started_at desc);

-- 3) Itens (parte pública quando published)
create table if not exists public.radar_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.radar_runs(id) on delete set null,
  topic text check (topic in ('rcp_dea', 'trauma_hemorragia', 'pediatria_neonatal', 'coluna')),
  population text check (population in ('adulto', 'pediatrico', 'neonatal', 'misto', 'nao_se_aplica')),
  source_name text not null,
  source_url text,
  doi text,
  pmid text,
  source_status text, -- ex.: situação no ILCOR (rascunho para consulta pública, CoSTR final)
  title_original text not null,
  title_pt text,
  authors text,
  published_date date,
  updated_date date,
  discovered_at timestamptz not null default now(),
  publication_type text check (publication_type in ('diretriz_final', 'consulta_publica', 'revisao', 'estudo_original', 'preprint', 'opiniao', 'outro')),
  study_design text,
  analysis_basis text check (analysis_basis in ('resumo', 'pagina_da_fonte')),
  summary_pt text,
  main_finding text,
  what_changed text,
  evidence_strength text,
  limitations text,
  applicability_br text,
  official_grade text, -- só trecho copiado da própria fonte; nunca classificação inventada
  "references" jsonb not null default '[]'::jsonb,
  status text not null default 'candidate'
    check (status in ('candidate', 'discarded', 'pending_analysis', 'analyzing', 'draft', 'approved', 'published', 'rejected', 'archived')),
  claimed_at timestamptz,
  error_count integer not null default 0,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_name text,
  approved_at timestamptz,
  published_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists radar_items_pmid_unique on public.radar_items (pmid) where pmid is not null;
create unique index if not exists radar_items_doi_unique on public.radar_items (lower(doi)) where doi is not null;
create unique index if not exists radar_items_url_unique on public.radar_items (source_url) where source_url is not null;
create index if not exists radar_items_status_idx on public.radar_items (status, discovered_at desc);

-- 4) Parte interna do item: texto bruto coletado (dado não confiável), orientações para os cursos, avisos
create table if not exists public.radar_item_private (
  item_id uuid primary key references public.radar_items(id) on delete cascade,
  raw_text text,
  relevance_note text,
  discard_reason text,
  course_updates text,
  editorial_action text check (editorial_action in ('atualizar_agora', 'acompanhar', 'divulgar')),
  pending_version jsonb, -- aviso ou análise nova da automação, esperando a sua revisão
  last_error text
);

-- 5) RLS
alter table public.radar_settings enable row level security;
alter table public.radar_runs enable row level security;
alter table public.radar_items enable row level security;
alter table public.radar_item_private enable row level security;

drop policy if exists "radar settings admin" on public.radar_settings;
create policy "radar settings admin" on public.radar_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "radar runs admin" on public.radar_runs;
create policy "radar runs admin" on public.radar_runs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "radar items admin" on public.radar_items;
create policy "radar items admin" on public.radar_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "radar items public published" on public.radar_items;
create policy "radar items public published" on public.radar_items
  for select to anon, authenticated using (status = 'published');

drop policy if exists "radar private admin" on public.radar_item_private;
create policy "radar private admin" on public.radar_item_private
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 6) Regras de aprovação (valem para qualquer caminho: site, SQL, automação)
create or replace function public.radar_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('approved', 'published') then
      raise exception 'Itens do radar entram como candidato ou rascunho; só uma revisão humana aprova.';
    end if;
    return new;
  end if;

  new.updated_at := now();

  -- automação (sem usuário logado): nunca aprova, publica nem altera conteúdo já aprovado
  if auth.uid() is null then
    if new.status in ('approved', 'published') and new.status is distinct from old.status then
      raise exception 'Somente uma pessoa autenticada como administrador pode aprovar ou publicar.';
    end if;
    if old.status in ('approved', 'published') and (
      new.title_pt, new.summary_pt, new.main_finding, new.what_changed, new.evidence_strength,
      new.limitations, new.applicability_br, new.official_grade, new."references", new.status
    ) is distinct from (
      old.title_pt, old.summary_pt, old.main_finding, old.what_changed, old.evidence_strength,
      old.limitations, old.applicability_br, old.official_grade, old."references", old.status
    ) then
      raise exception 'Conteúdo aprovado só muda por revisão humana (a automação grava uma versão pendente à parte).';
    end if;
    return new;
  end if;

  -- revisão humana
  if new.status is distinct from old.status then
    if new.status = 'published' and old.status not in ('approved', 'published') then
      raise exception 'Aprove o item antes de publicar.';
    end if;
    if new.status = 'approved' and old.status not in ('approved', 'published') then
      new.reviewer_id := auth.uid();
      new.reviewer_name := coalesce((select nullif(full_name, '') from public.profiles where id = auth.uid()), 'Hanif Alves');
      new.approved_at := now();
    end if;
    if new.status = 'published' and old.status is distinct from 'published' then
      new.published_at := now();
    end if;
    if old.status = 'published' and new.status is distinct from 'published' then
      new.published_at := null;
    end if;
    if new.status in ('draft', 'rejected', 'archived', 'pending_analysis', 'discarded', 'candidate') then
      if old.status in ('approved', 'published') and new.status = 'draft' then
        new.reviewer_id := null; new.reviewer_name := null; new.approved_at := null;
      end if;
    end if;
  end if;

  if old.status in ('approved', 'published') and (
    new.title_pt, new.summary_pt, new.main_finding, new.what_changed, new.evidence_strength,
    new.limitations, new.applicability_br, new.official_grade, new."references"
  ) is distinct from (
    old.title_pt, old.summary_pt, old.main_finding, old.what_changed, old.evidence_strength,
    old.limitations, old.applicability_br, old.official_grade, old."references"
  ) then
    new.version := old.version + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists radar_items_guard on public.radar_items;
create trigger radar_items_guard before insert or update on public.radar_items
for each row execute function public.radar_items_guard();
