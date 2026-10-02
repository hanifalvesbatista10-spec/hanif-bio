# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profissionais e estudantes de atendimento pré-hospitalar (APH): técnicos de enfermagem socorristas, instrutores de APH, instrumentadores cirúrgicos e áreas correlatas de urgência/emergência. Estão buscando segurança e método para decidir rápido em situações críticas reais (atendimento pré-hospitalar), não apenas acumular teoria.

## Product Purpose

Plataforma de cursos, mentorias e materiais de ensino em APH/urgência-emergência. Vende acesso a conteúdo (vídeo-aulas via Mux, provas/simulados, certificados) através de um checkout próprio (Pix, cartão parcelado, boleto) e libera acesso automaticamente após confirmação de pagamento. Sucesso = o aluno treina o raciocínio clínico antes da pressão real e consegue agir com método num atendimento crítico.

## Positioning

Experiência de linha de frente (10 anos atuando, SAMU 192, instrutor de APH) transformada em ensino aplicável — conteúdo direto, didático, baseado em evidências e conectado à realidade do atendimento pré-hospitalar, em vez de teoria genérica desconectada da prática.

## Operating Context

- Alunos entram pela área de membros (login) para assistir aulas, fazer provas/simulados e emitir certificados.
- Compra acontece num checkout próprio: Pix/cartão (InfinitePay) ou boleto (Asaas); cupom de desconto opcional; acesso liberado automaticamente após pagamento confirmado (ou na hora, se o pedido ficar grátis por cupom de 100%).
- Produtos oferecidos no checkout podem incluir "ofertas extras" (order bump): outros cursos/produtos com preço especial, marcados com 1 clique na mesma compra.
- Admin (Hanif Alves e equipe) gerencia produtos, cupons, pedidos, afiliados, certificados e recuperação de carrinho abandonado por um painel próprio.

## Capabilities and Constraints

- Site React 18 + Vite + React Router (SPA), back-end em funções serverless da Vercel, banco Supabase (Postgres + RLS).
- Pagamento: InfinitePay (Pix/cartão) e Asaas (boleto); e-mail transacional via Resend; vídeo via Mux.
- Checkout já existente e funcional (`src/pages/public/CheckoutPage.jsx`, `src/styles/checkout.css`) — este é o alvo do redesign atual.
- Domínio de produção: www.aphhardcore.com.

## Brand Commitments

- Nome: Hanif Alves.
- Paleta confirmada pelo usuário: navy + vermelho.
- Tom de voz já presente no site: direto, técnico, baseado em evidência, sem exagero — fala com quem já trabalha em linha de frente (ex.: "Em uma emergência, confiança não pode depender de improviso.").

## Evidence on Hand

- Depoimentos reais de alunos existem e são exibidos publicamente (`src/components/feedbacks/PublicFeedbacks.jsx`, dados vindos do banco, não fabricados).
- Textos institucionais (hero, autoridade, método, FAQ) são editáveis pelo admin via `site_settings`/`site_content`/`site_faqs` — o fallback mostrado no código é apenas um default, não o texto final garantido.
- Não fabricar depoimentos, números, cases ou provas sociais novos para o checkout além do que já existe no banco.

## Product Principles

1. Autoridade de linha de frente, não teoria de sala de aula — toda comunicação reforça experiência prática real (SAMU, instrutor de APH).
2. Clareza e confiança acima de enfeite — o público decide sob pressão no trabalho; o site não deve ser confuso ou genérico.
3. Checkout é ponto de conversão crítico: precisa transmitir segurança (pagamento, dados, liberação de acesso) tanto quanto atratividade visual.
4. Preservar função e lógica existentes do checkout (cupom, order bump, parcelamento, boleto) — o redesign é visual/de layout, não uma reescrita de comportamento.
