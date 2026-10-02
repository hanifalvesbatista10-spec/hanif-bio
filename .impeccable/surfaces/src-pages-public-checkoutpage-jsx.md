---
version: 1
slug: "src-pages-public-checkoutpage-jsx"
primary_target: "src/pages/public/CheckoutPage.jsx"
related_targets: ["src/styles/checkout.css"]
---

## Scope and visitor mode

Surface: `src/pages/public/CheckoutPage.jsx` + `src/styles/checkout.css` (rota `/checkout/:slug`). Modo: Operate (o visitante já decidiu comprar; a tarefa é preencher dados e pagar com confiança e o mínimo de fricção). Extensão de um mundo visual já estabelecido (tokens.css, home.css, member-shell.css) — não é criação de identidade nova.

## Audience, job, action, proof, constraints

- Audiência: profissionais e estudantes de APH (técnicos de enfermagem socorristas, instrutores de APH etc.) comprando curso/mentoria, muitas vezes sob rotina de trabalho apertada — decidem rápido, mas pelo tipo de profissão, confiam em processo e sequência clara (pensam em protocolo).
- Tarefa: preencher dados (nome, e-mail, CPF, WhatsApp), escolher forma de pagamento (Pix/cartão ou boleto), opcionalmente aplicar cupom e marcar ofertas extras (order bump), e confirmar o pagamento.
- Ação principal: botão de pagar/gerar boleto.
- Prova: produto, preço (com desconto do cupom quando houver), parcelamento, selo de compra segura — tudo dado real já carregado do banco (sem depoimento ou número inventado).
- Restrições: preservar toda a função e lógica existentes (cupom desconta só o principal, order bump com preço próprio, boleto vs Pix/cartão, validação de CPF/e-mail, estado de carregamento/erro) — o redesign é só visual/estrutural.

## Direction contract

THESIS: As 3 etapas da compra (Dados, Pagamento, Liberação) viram um painel de status que acende conforme avança, trocando a ansiedade de "quanto falta" por clareza objetiva — recusa o checkout genérico de formulário solto sem noção de progresso.

OWN-WORLD: Herda o sistema claro já estabelecido em `tokens.css` (não usado hoje por `checkout.css`, que hardcoda suas próprias cores): fundo `--brand-surface-muted` (#f4f7fa), cartões `--brand-surface` brancos com `--shadow-card`/`--shadow-elevated`, texto `--brand-text` sobre `--brand-navy`, acento `--brand-red` só em estados ativos/CTAs/badges preenchidos, títulos e preços em `--font-display` (Barlow Semi Condensed), corpo em `--font-sans` (Inter), raios `--radius-md`/`--radius-lg`. Nenhuma paleta ou família tipográfica nova — é a mesma identidade do resto do site, só que finalmente aplicada aqui.

STORY: O visitante enxerga de cara em que etapa está (badges Dados / Pagamento / Liberação), preenche os dados sabendo que o pagamento vem depois, e vê a oferta extra (order bump) como "equipamento adicional" dentro do próprio resumo fixo do pedido, não como uma seção separada ou pop-up.

FIRST VIEWPORT: Barra de progresso fina no topo do cartão principal. Abaixo dela, os 3 badges de etapa (contorno vazio → preenchido em vermelho conforme completa). O formulário da etapa ativa ocupa a coluna esquerda (7/12 no desktop). O resumo do pedido fica fixo à direita (5/12), com a prateleira de "equipamento adicional" (bumps) embutida dentro do próprio resumo — cada item com checkbox e preço alinhado à direita. No mobile, o resumo some para um bloco recolhido no topo e as etapas colapsam em pilha única.

FORM: Painel de Triagem — candidato nº5 da lista de 7 estruturas derivadas para este checkout, ordenada por ressonância (1. Mission brief stepper tipo protocolo ABCDE, 2. Dossiê/ficha de caso, 3. Console de transmissão segura, 4. Manual de Campo, 5. Painel de Triagem, 6. Pista única sem distrações, 7. Barra de Comando). O dado (concept-seed, seed key `d9f73531`, scope surface, mode operate) assinalou os índices 7, 4, 5 com o 7 liderando; o usuário escolheu em palavras o candidato nº5 (Painel de Triagem) em vez do líder sorteado (Barra de Comando) — decisão do usuário vale sobre o dado, como sempre.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Signature interaction / memorable moment

Os 3 badges de etapa mudam de contorno vazio para preenchido em vermelho (`--brand-red`) com uma transição curta (`--transition-fast`) exatamente quando aquela etapa é validada — nunca de forma abrupta. A prateleira de "equipamento adicional" (bumps) dentro do resumo soma o total em tempo real ao marcar/desmarcar, sem recarregar nada.

## Unresolved decisions

Nenhuma — build é code-led (sem geração de imagem disponível neste ambiente), ambição carregada neste contrato e auditada no finish review via comportamento, não comp.
