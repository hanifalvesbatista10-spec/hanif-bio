-- TORNA EDITÁVEL PELO PAINEL O CONTEÚDO QUE HOJE ESTÁ FIXO NO CÓDIGO
-- (chips de cargo, "por que isso importa" e as áreas de atuação da página Sobre).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva: apenas adiciona colunas com valor
-- padrão igual ao texto que já está publicado hoje — nada muda visualmente
-- até o administrador editar algo em /admin/site.

alter table public.site_settings
  add column if not exists products_section_title text
    not null default 'Escolha o próximo passo da sua evolução profissional.',
  add column if not exists value_section_title text
    not null default 'Em uma emergência, confiança não pode depender de improviso.',
  add column if not exists professional_roles jsonb
    not null default '["Técnico de Enfermagem Socorrista","Instrutor de APH","Instrumentador Cirúrgico","Analista de Dados"]'::jsonb,
  add column if not exists value_props jsonb
    not null default '[
      {"title":"Reconhecer rápido","text":"Organize o raciocínio para identificar prioridades sem perder tempo com o que não muda a conduta."},
      {"title":"Decidir com método","text":"Conecte avaliação, princípios e preferências para sustentar decisões mais consistentes."},
      {"title":"Treinar antes da pressão","text":"Construa repertório antes do atendimento real exigir resposta imediata."}
    ]'::jsonb,
  add column if not exists about_areas jsonb
    not null default '[
      {"title":"Atuação prática em urgência e emergência","text":"Experiência real de linha de frente no atendimento pré-hospitalar, hoje traduzida em conteúdo didático e aplicável para quem estuda e atua na área."},
      {"title":"Formação como instrutor de APH","text":"Preparo de estudantes e profissionais da saúde para tomar decisões com mais segurança diante de situações críticas."},
      {"title":"Instrumentação cirúrgica e análise de dados","text":"Áreas de atuação complementares que reforçam o rigor técnico e a organização por trás de cada treinamento e material produzido."}
    ]'::jsonb;
