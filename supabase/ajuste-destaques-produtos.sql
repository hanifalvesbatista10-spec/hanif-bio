-- AJUSTE DE CONTEÚDO: preenche "Destaques" dos 3 produtos ativos, com base no que já está escrito na
-- descrição de cada um (nada foi inventado). Não é uma migração de banco (não precisa entrar na sequência
-- numerada nem no comando de clonar a plataforma): é só um ajuste de dado, para rodar uma vez.
-- Depois de rodar, confira e ajuste o texto em Produtos, se quiser.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run (exige a 31_produto_destaques.sql já executada).

update public.products set highlights = array[
  '180 horas de carga horária',
  'Aulas presenciais em Barro/CE',
  'Vivências práticas com cenários reais',
  'Turma aberta, vagas limitadas'
] where slug = 'curso-intensivo-de-atendimento-pre-hospitalar-barro-ce';

update public.products set highlights = array[
  '80 horas de conteúdo',
  'PCR, OVACE, IAM, AVC e outras emergências',
  '100% on-line, no seu ritmo',
  'Acesso liberado na hora'
] where slug = 'curso-de-emergencias-clinicas-no-aph';

update public.products set highlights = array[
  'Acompanhamento de 3 meses',
  'Formato híbrido',
  'Foco no raciocínio clínico e na tomada de decisão',
  'Para estudantes e profissionais da saúde'
] where slug = 'mentoriaaph';

-- Confere o resultado
select title, highlights from public.products
where slug in (
  'curso-intensivo-de-atendimento-pre-hospitalar-barro-ce',
  'curso-de-emergencias-clinicas-no-aph',
  'mentoriaaph'
);
