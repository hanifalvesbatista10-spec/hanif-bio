# hanif-bio — contexto do projeto

Plataforma de Hanif Alves (instrutor de APH, urgência e emergência): site público, vendas, área de membros e painel administrativo. Público: profissionais e estudantes de APH. Detalhes de produto e posicionamento em `PRODUCT.md`. A interface e a comunicação com o dono são em **português do Brasil**.

> `README.md` está desatualizado (cita Kiwify). A fonte de verdade é o código, `PRODUCT.md`, `docs/` e `SECURITY_AUDIT.md`.

## Stack

- **Frontend:** React 18 + Vite 6 + React Router 7 (SPA), JavaScript (`.jsx`), CSS puro com tokens em `src/styles/tokens.css`. Sem TypeScript, Tailwind ou shadcn.
- **Backend:** funções serverless na Vercel em `api/` (ajudantes em `api/_lib/`). Plano grátis (Hobby).
- **Banco:** Supabase (Postgres + RLS + Auth + Storage). Projeto `hanif-alves-plataforma` (ref `qgenfhyzobauknptwsex`).
- **Integrações:** Mux (vídeo das aulas), Cloudflare R2 (arquivos para download), InfinitePay (Pix/cartão), Asaas (boleto), Resend (e-mail), Telegram (avisos ao dono), Daily.co (encontros ao vivo), Gemini ou Anthropic (IA do Radar de Evidências).
- **Hospedagem:** Vercel, projeto `hanif-bio`, domínio `www.aphhardcore.com`. Deploy automático a cada push na `main`.

## Comandos

```bash
npm install
npm run dev      # Vite em http://localhost:5173 (configuração em .claude/launch.json: "hanif-bio-dev")
npm run build    # confere se compila
npm run preview
```

Não há suíte de testes nem lint configurados: a verificação é `npm run build` mais teste no navegador. Em `npm run dev` as rotas `/api/*` **não existem** (só no site publicado); o ambiente local usa o mesmo banco Supabase da produção, então escritas locais são reais.

## Estrutura

```
src/pages/{public,student,admin,auth}   páginas por área
src/components/{admin,member,layout,sections,ui,...}
src/services/                           acesso a dados e clientes das APIs (supabase.js, mux.js, r2.js, radar.js...)
src/styles/                             tokens.css e CSS por área
src/App.jsx                             todas as rotas (admin em /admin/*, aluno em /minha-area/*)
api/                                    funções serverless; api/_lib/ = código compartilhado
supabase/NN_*.sql                       migrations numeradas, rodadas manualmente (última: 50)
docs/                                   guias de operação (checkout, mux, afiliados, provas...)
```

## Convenções

- **Migrations:** arquivo novo `supabase/NN_descricao.sql`, incremental, idempotente (`if not exists`, `drop policy if exists`), com cabeçalho em português explicando o que faz. Nunca editar migration antiga.
- **RLS e autorização:** administrador é checado por `public.is_admin()`. Automação com chave de serviço não aprova nem publica conteúdo (regra no banco). Segredos só no servidor; só `VITE_*` chegam ao navegador.
- **Limite de 12 funções na Vercel Hobby (hoje 12):** nova rota deve entrar como ação de uma função existente (padrão em `api/r2-sign.js`, `api/mux-asset.js` e `api/cron-recover-sales.js?job=...`) ou juntar funções. Há no máximo 2 crons (diário de recuperação de vendas e semanal do Radar). Só a função do cron (`api/cron-recover-sales.js`) tem `maxDuration` de 60 s configurado em `vercel.json`; as demais usam o padrão da Vercel.
- **Variáveis de ambiente:** mudança só vale após novo deploy (Redeploy). Nunca imprimir nem commitar valores.
- **Admin:** novas telas entram em `src/App.jsx` (rota) e `src/components/admin/adminNav.js` (menu). As telas de edição voltam para a lista depois de salvar.
- **Design:** usar os tokens (`--brand-navy`, `--brand-red`, `--font-display`). Skill `impeccable` manda no visual; `PRODUCT.md` é o contexto de marca.

## Regras de trabalho com o dono

- **Commit e push só quando o dono escrever "Faça o commit e o push".** Nada de deploy, merge ou PR por conta própria.
- Testar de verdade antes de reportar (build e navegador; produção só com dados fictícios e limpando depois). Relatar de forma direta, em português.
- SQL em produção (via SQL Editor ou conector do Supabase) só depois de mostrar o que vai rodar; nada destrutivo sem confirmação.
- Avisar quando for preciso Redeploy, variável nova ou SQL manual.

## Equipe de agentes (`.claude/agents/`)

O agente principal escolhe os especialistas pelo tipo de tarefa. Tarefa pequena vai direto a um especialista (ou é feita sem delegar).

| Agente | Quando |
|---|---|
| `orchestrator` | tarefas multi-área, ambíguas ou grandes; planeja, delega e valida |
| `ui-ux` | design, layout, responsividade, acessibilidade, landing pages |
| `frontend` | implementação React, formulários, integração com APIs/Supabase |
| `supabase` | tabelas, migrations, RLS, Auth, Storage (escreve SQL, não executa) |
| `content-copy` | textos de interface, CTAs, páginas de venda |
| `security` | auditoria de autenticação, autorização, RLS, endpoints, segredos |
| `qa` | teste real de fluxos, regressões, desktop e celular |
| `code-review` | revisão final do diff |

Os agentes `impeccable-*` pertencem ao fluxo da Skill `impeccable`; não chamar diretamente.

## Skills (nomes reais)

- `superpowers:*` (plugin 6.3.0): método (brainstorming, writing-plans, systematic-debugging, verification-before-completion, requesting/receiving-code-review...).
- `impeccable` (projeto + plugin 4.2.0): design e interface.
- `humanizer` (plugin 2.11.2): naturalizar textos; padrões escritos para inglês.
- `landing-page`: existe só no nível da conta Claude, não como Skill local.
- `owasp-security` e `VibeSec-Skill`: em `.agents/skills/` (o Claude Code não as carrega sozinho; ler `SKILL.md` pelo caminho).
