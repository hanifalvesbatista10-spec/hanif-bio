# Reconstrução do site público — Hanif Alves Bio

Status: **aprovado pelo usuário em 2026-09-17**, em execução nesta sessão. Sem commit/push/deploy até autorização explícita.

## Contexto confirmado por auditoria

- Stack real: React 18 + Vite 6 + React Router 7 + `@supabase/supabase-js` 2. CSS puro, sem Tailwind (a menção a Tailwind na missão não se aplica a este repo — mantemos CSS puro).
- Sem lockfile prévio, sem `.gitignore`, sem `node_modules`. Corrigido: `npm install` gerou `package-lock.json`; `.gitignore` criado; `npm run build` roda limpo (0 erros, aviso de bundle único de 567KB por falta de code-splitting do admin).
- Home ao vivo: `src/pages/public/ConversionHomePage.jsx` (rota `/`, ver `src/App.jsx`). Já busca `site_settings` e `products` do Supabase, renderiza `PublicFeedbacks` (depoimentos públicos sem login) e mantém checkout misto (Kiwify para a Mentoria APH via `productCheckout.js`, Hotmart/WhatsApp para os demais via `checkout_url`/`whatsapp_url` do Supabase).
- Logomarca oficial "HA" **existe**, mas estava embutida em base64 dentro de `src/pages/LegacySite.jsx` (código morto, não roteado) — nunca extraída nem usada na home ao vivo. Será extraída como está (sem redesenho) para `public/assets/logo-ha.png`.
- Código morto confirmado (nenhuma outra parte do app referencia): `src/pages/LegacySite.jsx`, `src/styles.css` (só importado pelo LegacySite), `src/components/products/DynamicProductsSection.jsx` (só importado pelo LegacySite; a home já lista todos os produtos ativos sozinha). Aprovado remover os três.
- `src/pages/student/StudentDashboard.jsx` existe mas não está roteado — fora de escopo, não será tocado.
- Sem `favicon`, `robots.txt`, `sitemap.xml` no projeto.
- Supabase (schema `supabase/01_setup_completo.sql` a `08_forms_activities.sql`) já cobre tudo que a reconstrução visual precisa. **Nenhuma migration é necessária.**

## Etapas

### 1. Inventário e preservação (concluído nesta auditoria)
Ver seção acima. Nenhuma ação adicional além do já registrado.

### 2. Tokens de marca
Criar `src/styles/tokens.css` com variáveis semânticas (`--brand-navy`, `--brand-navy-deep`, `--brand-red`, `--brand-red-hover`, `--brand-off-white`, `--brand-surface`, `--brand-border`, `--brand-text`, `--brand-muted`, tipografia e espaçamentos) extraídas das cores já usadas em `ConversionHomePage.jsx` (`#071426`, `#d6152d`, `#f7f9fb`) e no logo extraído (branco sobre navy). Importar globalmente em `src/main.jsx`.

### 3. Arquitetura da informação da home
Reordenar `ConversionHomePage.jsx` mantendo apenas seções com conteúdo real: Header → Hero → Faixa de autoridade (dados reais já existentes: SAMU 192, instrutor APH) → Produtos/treinamentos (dinâmico do Supabase) → Por que isso importa (valor) → Sobre o instrutor → Depoimentos (`PublicFeedbacks`) → CTA final → Footer. Sem seção de comunidade/eventos dedicada na home por ora (produto "Comunidade APH" já aparece no grid de produtos; evento Aulão do Barro já tem página própria em `/evento/aulao-barro`).

### 4. Header e Hero
- Header: extrair para `src/styles/site.css`; usar `logo-ha.png` (não mais apenas texto), comportamento sticky com estado "compacto" após scroll (fundo navy mais sólido + sombra sutil), nav com âncoras existentes, CTA em vermelho.
- Hero: usar `hanif-hero.png` em tratamento editorial de página inteira (não mais miniatura), overlay para legibilidade, headline/subheadline vindos de `site_settings` (sem alterar textos factuais sem necessidade), dois CTAs (primário/secundário já existentes nos settings).
- Sem vídeo (não há asset de vídeo real no projeto).

### 5. Seções públicas
Reescrever CSS das seções (produtos, valor, sobre, CTA final, footer) para grid editorial com hierarquia tipográfica mais forte, usando os tokens da etapa 2. Sem alterar a lógica de dados (mesmas queries Supabase, mesmos campos).

### 6. Páginas de produto e conteúdos
Fora do escopo principal desta rodada (já existem páginas próprias funcionais: `PublicProductPage`, `MentorshipPage`, `EventBarroPage`). Ajuste apenas se o tempo permitir, sem tocar em preço/checkout/conteúdo.

### 7. Integração Supabase existente
Sem mudanças de schema. Nenhuma nova tabela, nenhuma coluna nova. Todas as queries existentes (`site_settings`, `products`, `student_feedbacks`) permanecem como estão.

### 8. Painel administrativo
Sem redesign. Único ajuste: lazy-load das rotas `/admin/*` em `src/App.jsx` via `React.lazy`/`Suspense` para reduzir o bundle público (objetivo de performance da seção 20 da missão), sem alterar comportamento funcional.

### 9. Mídia e imagens
- Extrair `logo-ha.png` de `LegacySite.jsx` para `public/assets/`.
- Reaproveitar `hanif-hero.png` existente (sem regenerar rosto/uniforme).
- Criar favicon a partir do próprio logo extraído.

### 10. SEO e acessibilidade
- `index.html`: favicon, canonical, Open Graph básico, manter `<title>`/`description` existentes (já corretos: "técnico de enfermagem socorrista e instrutor de APH").
- Criar `public/robots.txt` e `public/sitemap.xml` com as rotas públicas reais.
- Garantir contraste AA nos novos tokens, `alt` correto no logo/hero, foco visível no header/CTAs.

### 11. Remoção de código morto
Remover `src/pages/LegacySite.jsx`, `src/styles.css`, `src/components/products/DynamicProductsSection.jsx` (aprovado pelo usuário; sem outras referências no projeto).

### 12. Testes e QA
- `npm run build` após as mudanças.
- QA visual via browser embutido em desktop (1440px) e mobile (390px): header sticky/compacto, hero, produtos, depoimentos, footer, menu mobile.
- Conferir console sem erros e Supabase ainda respondendo (produtos/depoimentos/site_settings carregando).

### 13. Preparação para commit
Sem commit/push nesta sessão. Ao final, listar arquivos alterados e sugerir mensagem de commit para o usuário executar/aprovar manualmente.
