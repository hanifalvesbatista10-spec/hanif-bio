# Auditoria de Segurança — hanif-bio

**Data:** 2026-10-01
**Escopo:** todo o repositório (`src/`, `api/`, `supabase/`), dependências (`npm audit`), análise estática (Semgrep) e histórico do git.
**Metodologia:** mapeamento de pontos de entrada → revisão manual linha a linha de todas as funções serverless (`api/`) e de todas as políticas RLS / funções `security definer` do banco (`supabase/`) contra o OWASP Top 10:2025 → varredura automática com Semgrep (`--config=auto`, 200 regras) → busca de segredos no código e no `git log -p` → `npm audit`.
**Nenhum arquivo além deste relatório foi alterado.**

## Resumo

O projeto está em **bom estado de segurança**. Os pontos mais sensíveis — webhooks de pagamento, cálculo de valores, controle de acesso ao vídeo protegido (Mux), e a grande maioria das políticas RLS — já seguem boas práticas: webhooks sempre reconferidos contra o provedor (nunca confiam só no aviso recebido), comparação de token em tempo constante, valor cobrado sempre recalculado no servidor, SECURITY DEFINER com `revoke`/`grant` explícitos na maioria das funções novas, e um gatilho (`supabase/18_dados_do_aluno.sql`) que já impede um aluno de virar admin alterando o próprio perfil.

Não foi encontrada nenhuma vulnerabilidade **crítica** ou **alta** explorável hoje. Os achados abaixo são de severidade **média** e **baixa** — nenhum é um "fechamento de porta" urgente, mas valem correção. O Semgrep encontrou 3 alertas; todos os 3 foram confirmados como **falsos positivos / não-problemas** (explicado em cada um). O `npm audit` encontrou 1 vulnerabilidade de severidade **baixa** numa dependência opcional não utilizada pelo caminho de código atual.

**Atualização (2026-10-01):** os 2 achados médios já foram corrigidos (ver selo ✅ em cada um).

| Severidade | Qtde | Status |
|---|---|---|
| Crítica | 0 | — |
| Alta | 0 | — |
| Média | 2 | ✅ 2 corrigidos |
| Baixa | 5 | em aberto |
| Informativo (hardening / já mitigado) | 3 | — |

---

## Fase 1 — Mapeamento

- **Stack:** React 18 + Vite 6 (SPA) na Vercel, com funções serverless em `api/*.js` (Node, sem framework). Banco: Supabase Postgres com RLS em (quase) toda tabela. Pagamento: InfinitePay (Pix/cartão) e Asaas (boleto). Vídeo protegido: Mux (tokens assinados). E-mail transacional: Resend.
- **Pontos de entrada (não autenticados):** `/api/checkout-create`, `/api/coupon-check`, `/api/checkout-status`, `/api/infinitepay-webhook`, `/api/asaas-webhook`, `/api/recovery-opt-out`, `/api/cron-recover-sales`, além de tudo que o anon key do Supabase alcança via RLS (formulário de afiliado, depoimento por link, verificação de certificado, etc.).
- **Pontos de entrada (autenticados):** `/api/mux-token`, `/api/mux-upload`, `/api/mux-asset` (admin), `/api/checkout-diagnose` (admin), e todas as leituras/escritas via `supabase-js` no painel admin e na área do aluno, mediadas por RLS.
- **Autenticação:** Supabase Auth (JWT). `api/_lib/mux.js` tem `requireUser`/`requireAdmin` que reconferem o JWT direto no Supabase Auth a cada chamada (não confiam em claims locais).
- **Dados pessoais:** CPF, nome, e-mail, telefone (checkout e perfil do aluno); RG e tipo sanguíneo (dados do aluno para certificado).
- **Segredos:** todos vêm de variáveis de ambiente da Vercel (nunca hardcoded, exceto a anon key pública — ver achado informativo). Nenhum `.env` real, chave privada ou token foi encontrado no histórico do git.

---

## Achados — Média

### [MÉDIA] ✅ CORRIGIDO — Webhook/redirect do checkout confiava no header `Origin` quando `SITE_URL` não estava configurado

**Local:** [api/_lib/checkout.js:159-162](api/_lib/checkout.js#L159-L162), usado em [api/checkout-create.js:81,123,128-129](api/checkout-create.js#L81)

```js
export function siteUrl(req) {
  const origin = process.env.SITE_URL || req?.headers?.origin || "";
  return /^https?:\/\//.test(origin) ? origin.replace(/\/$/, "") : "";
}
```

**Como seria explorado:** se a variável `SITE_URL` não estiver configurada na Vercel (ex.: esquecida num novo deploy, ou um ambiente de preview), a função cai para `req.headers.origin`. Esse cabeçalho é controlado por quem faz a requisição — num `POST` direto (não vindo do navegador, ex. via `curl`/`fetch` de script), qualquer valor pode ser enviado. Isso é usado para montar:
- `webhook_url` mandado para a InfinitePay (`${base}/api/infinitepay-webhook`): um atacante poderia apontar o aviso de pagamento de um pedido criado por ele mesmo para outro domínio.
- `redirect_url` (para onde o comprador volta depois de pagar): poderia virar um redirecionamento aberto para um domínio de phishing, embora o atacante só consiga isso no próprio checkout dele.

O impacto prático depende de `SITE_URL` estar ou não configurada hoje em produção (provavelmente está, já que o checkout funciona) — mas o código não deveria depender disso: é uma proteção que só existe "sem querer".

**Correção sugerida:** nunca usar o header como origem de confiança; exigir `SITE_URL` sempre.

```js
export function siteUrl() {
  const origin = process.env.SITE_URL || "";
  return /^https?:\/\//.test(origin) ? origin.replace(/\/$/, "") : "";
}
```

E em `checkout-create.js`, trocar `siteUrl(req)` por `siteUrl()` (tirando o fallback pro header em todo lugar que usa essa função, incluindo `checkout-diagnose.js` e `cron-recover-sales.js`).

**Correção aplicada:** `siteUrl()` não recebe mais `req` e usa só `SITE_URL`; os 3 pontos de chamada (`checkout-create.js`, `checkout-diagnose.js`, `cron-recover-sales.js`) foram atualizados.

---

### [MÉDIA] ✅ CORRIGIDO — `/api/cron-recover-sales` ficava aberto ao público se `CRON_SECRET` não estivesse configurado

**Local:** [api/cron-recover-sales.js:21-28](api/cron-recover-sales.js#L21-L28)

```js
function verifyCron(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) {
    console.warn("cron-recover-sales: CRON_SECRET não configurado, a rota está sem proteção.");
    return true;
  }
  return (req.headers.authorization || "") === `Bearer ${secret}`;
}
```

**Como seria explorado:** o próprio comentário do código já avisa disso. Sem `CRON_SECRET` configurado, qualquer pessoa pode chamar `GET /api/cron-recover-sales` quantas vezes quiser, disparando e-mails de "recuperação de vendas" para todo mundo com pedido pendente/falhado — gasto da cota do Resend, possível dano à reputação de envio (spam), e incômodo para os compradores reais.

**Correção sugerida:** falhar fechado (negar por padrão) em vez de falhar aberto:

```js
function verifyCron(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false; // sem CRON_SECRET configurado, a rota fica bloqueada até você configurar
  return (req.headers.authorization || "") === `Bearer ${secret}`;
}
```

E ajustar a mensagem de erro em `cron-recover-sales.js` (handler principal) para indicar que falta configurar `CRON_SECRET`, já que hoje a ausência da variável vira silenciosamente "autorizado".

**Correção aplicada:** `verifyCron` agora devolve `false` (bloqueia) quando `CRON_SECRET` não está configurado, em vez de `true`.

---

## Achados — Baixa

### [BAIXA] Nome do comprador interpolado sem escape no corpo HTML do e-mail de recuperação

**Local:** [api/cron-recover-sales.js:37-48](api/cron-recover-sales.js#L37-L48)

```js
function emailHtml({ name, intro, url, coupon, unsub }) {
  const firstName = String(name || "").trim().split(/\s+/)[0] || "";
  return `<div ...>
    <p>Oi${firstName ? ` ${firstName}` : ""},</p>
    <p>${intro}</p>
    ...
```

**Como seria explorado:** `name` vem de `order.buyer_name`, preenchido pelo próprio comprador no checkout (`api/checkout-create.js`, só valida tamanho mínimo, não escapa HTML). Um comprador poderia preencher o nome com `<a href="https://site-falso.com">` ou tags de formatação, que iriam para dentro do HTML do e-mail de recuperação sem escape. A maioria dos clientes de e-mail neutraliza `<script>`, mas `<a>`, `<img>` e CSS inline geralmente passam — dá para alterar o visual do e-mail ou trocar o link "Concluir minha compra" por outro.

**Correção sugerida:** escapar o nome (e qualquer outro campo vindo do pedido) antes de interpolar:

```js
const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function emailHtml({ name, intro, url, coupon, unsub }) {
  const firstName = escapeHtml(String(name || "").trim().split(/\s+/)[0] || "");
  ...
```

(`intro` já é montado internamente com `product.title`, que é texto cadastrado por você no admin — baixo risco, mas o mesmo `escapeHtml` pode ser aplicado por consistência.)

---

### [BAIXA] Comparação do token de "não quero mais receber" não é em tempo constante

**Local:** [api/recovery-opt-out.js:25](api/recovery-opt-out.js#L25)

```js
if (!expected || token !== expected) {
```

**Como seria explorado:** `token !== expected` compara strings caractere a caractere, parando no primeiro que diferir — teoricamente permite inferir o token certo por tempo de resposta (ataque de timing). Na prática é de exploração muito difícil pela internet (jitter de rede), e o token é HMAC-SHA256 truncado em 24 hex (96 bits), então mesmo um timing attack bem-sucedido não reduziria a busca a algo viável. O próprio projeto já tem a função certa para isso (`safeEqual`, usada no webhook do Asaas) — só não foi usada aqui.

**Correção sugerida:**

```js
import { safeEqual } from "./_lib/checkout.js";
// ...
if (!expected || !safeEqual(token, expected)) {
```

---

### [BAIXA] Dependência `dompurify` com advisory conhecido (transitiva, não exercida pelo código atual)

**Local:** `package-lock.json` — `dompurify@3.4.13–3.4.15`, dependência opcional de `jspdf` (usada em `src/services/certificates.js`).

**npm audit:**
```
dompurify  3.4.13 - 3.4.15  (low)
DOMPurify: IN_PLACE node-removing afterSanitize hook leaves detached subtree event handlers armed
https://github.com/advisories/GHSA-p98j-92pf-mc4p
```

**Como seria explorado:** a vulnerabilidade é no caminho SVG→canvas (`canvg`) do jsPDF, que usa o DOMPurify internamente. Conferi `src/services/certificates.js`: a geração do PDF do certificado usa `canvas.toDataURL("image/jpeg")` + `addImage` (renderização via `html2canvas`, não via SVG/`canvg`), então esse caminho vulnerável não é exercitado hoje. Mesmo assim, por ser fácil de corrigir:

**Correção sugerida:**
```bash
npm update dompurify
npm audit
```
(ou, se o `npm audit fix` não resolver sozinho por ser dependência opcional de terceiro nível, fixar a versão em `overrides` no `package.json`.)

---

### [BAIXA / HARDENING] Sem headers de segurança globais (CSP, X-Frame-Options, etc.)

**Local:** [vercel.json](vercel.json)

**Situação:** hoje só `/sw.js`, `/manifest.webmanifest` e `/v-0fd6c5b906b4/*` têm headers customizados. O resto do site (incluindo todas as páginas e `/api/*`) não define `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` ou `Strict-Transport-Security`.

**Impacto:** não é uma vulnerabilidade isolada, mas reduz as camadas de defesa contra clickjacking (o site pode ser colocado num `<iframe>` de outro domínio) e contra MIME-sniffing. Como não há `dangerouslySetInnerHTML` nem XSS conhecido hoje, o risco de uma CSP ausente é baixo agora — mas é a rede de segurança que pega um XSS futuro antes que vire algo pior.

**Correção sugerida** (adicionar em `vercel.json`, no array `headers`, com `"source": "/(.*)"`):

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
  ]
}
```
(CSP fica para depois, com calma: o site carrega Mux, Supabase, Google Ads e outros domínios externos, então uma CSP mal calibrada quebra essas integrações — vale testar em `Content-Security-Policy-Report-Only` antes de aplicar de verdade.)

---

### [BAIXA / HARDENING] Sem limite de requisições (rate limiting) nos endpoints públicos

**Local:** [api/checkout-create.js](api/checkout-create.js), [api/coupon-check.js](api/coupon-check.js), [api/cron-recover-sales.js](api/cron-recover-sales.js)

**Impacto:** a Vercel não limita chamadas por padrão. Isso permite, em tese: (a) testar cupons em massa em `coupon-check` até adivinhar um código válido (códigos curtos tipo "TURMA10" são mais fracos que um UUID); (b) criar muitos pedidos "pending" em `checkout-create`, gerando custo de chamadas à InfinitePay/Asaas; (c) se `CRON_SECRET` não estiver configurado (achado acima), bombardear `cron-recover-sales`. Nenhum desses gera acesso indevido a dados — é mais custo/abuso do que vazamento.

**Correção sugerida:** a forma mais simples sem adicionar infraestrutura nova é um rate limit por IP guardado no próprio Supabase (uma tabela `rate_limits` com upsert e contagem por janela de tempo) ou, mais simples ainda, ativar o **Vercel Firewall** (plano gratuito já inclui regras básicas de rate limit por rota) nas 3 rotas acima.

---

## Verificado e considerado seguro (vale registrar)

- **`profiles.role` / `profiles.account_status`** — à primeira vista, a política `"profile own update safe"` ([supabase/01_setup_completo.sql:174](supabase/01_setup_completo.sql#L174)) permite que o próprio aluno dê `UPDATE` no seu perfil sem restringir quais colunas, o que pareceria permitir virar admin sozinho. **Mas isso já está bloqueado**: o gatilho `protect_profile_privileged_columns` ([supabase/18_dados_do_aluno.sql:20-38](supabase/18_dados_do_aluno.sql#L20-L38)) força `role` e `account_status` de volta ao valor antigo sempre que quem está alterando não é admin. Confirmei a lógica no código; só não tenho como confirmar por fora se esse SQL já rodou no banco de produção (não tenho acesso de admin). **Recomendo**: confirmar no Supabase (Database → Functions/Triggers) que `profiles_protect_privileged` existe e está ativo. Como reforço (não obrigatório, já que o gatilho já resolve), dá para também restringir por coluna: `revoke update on public.profiles from authenticated; grant update (full_name, email, avatar_url, phone, cpf, rg, blood_type) on public.profiles to authenticated;`.
- **Webhooks de pagamento** (`infinitepay-webhook.js`, `asaas-webhook.js`) — nunca confiam só no aviso recebido. A InfinitePay é sempre reconferida na API deles (`payment_check`); o Asaas tem token comparado em tempo constante (`safeEqual`) e confere o valor pago contra o valor do pedido. Idempotência via tabela `payment_events` com índice único.
- **Valor cobrado** — sempre calculado no servidor (`priceInCents`, `resolveCoupon`), nunca aceito do navegador.
- **Vídeo protegido (Mux)** — token assinado só é emitido depois de `fetchLessonForUser`, que passa pelo RLS com o JWT do próprio usuário (admin ou aluno com acesso ativo e aula publicada).
- **Funções `security definer`** — a grande maioria tem `revoke`/`grant` explícitos (a própria `supabase/23_fechar_funcoes_internas.sql` documenta que o Supabase dá EXECUTE a `anon`/`authenticated` por padrão em função nova, e foi corrigido). As funções sensíveis que ficaram com grant amplo (`class_performance`, `my_performance`) conferem `is_admin()`/dono por dentro antes de devolver qualquer dado.
- **Comentários de aula** (`lesson_comments`) — gatilho `lesson_comments_before_insert` preenche `author_role`/`author_name` a partir do perfil real, o aluno não consegue forjar ser admin na resposta.
- **Cupons e comissão de afiliado** — recalculados inteiramente no servidor; `code` validado por regex e escapado antes de ir para o filtro `ilike` do PostgREST.
- **Nenhuma injeção de SQL/PostgREST encontrada** — toda interpolação de valor vindo de requisição (`id`, `orderId`, `slug`) é validada por regex (UUID ou `[A-Z0-9_-]`) antes de entrar na query, ou vem de uma linha já lida do banco (não do input bruto).
- **Nenhum segredo real no código ou no histórico do git** — só a chave `anon` pública do Supabase aparece hardcoded (ver achado informativo abaixo); nenhuma chave privada, service role key, token do Asaas/Mux/Resend ou senha foi encontrada em `git log -p`.

---

## Semgrep — 3 alertas, 3 descartados (nenhum vira achado)

Rodado com `semgrep --config=auto` (1074 regras da comunidade, 200 aplicáveis ao projeto).

1. **`generic.secrets.security.detected-jwt-token`** em [src/services/supabase.js:12](src/services/supabase.js#L12) e [api/_lib/mux.js:11](api/_lib/mux.js#L11) — detectou a **chave `anon` pública** do Supabase, hardcoded como valor padrão (fallback) quando a variável de ambiente não está definida. **Descartado**: essa chave é *pública por design* no modelo do Supabase — ela já vai para o navegador em todo app que usa `@supabase/supabase-js`, e a segurança vem inteiramente do RLS, não de esconder essa chave. Não é um segredo vazado.
   - *Única ressalva de higiene* (não é o achado do Semgrep, é meu): manter um valor hardcoded como fallback significa que trocar a chave no futuro exige lembrar de tirar o fallback do código também. Prefira exigir a env var sem fallback, se for mexer nesse arquivo por outro motivo.
2. **`javascript.lang.security.audit.unsafe-formatstring`** em [api/checkout-create.js:153](api/checkout-create.js#L153) — `console.error(`${PROVIDER_BY_METHOD[method]} error:`, error.status, error.message)`. **Descartado**: a regra flagra o primeiro argumento do `console.error` por ser um template string, mas ele só pode valer `"infinitepay error:"` ou `"asaas error:"` (vem de `PROVIDER_BY_METHOD[method]`, e `method` já foi validado contra uma lista fixa antes). Não há como um atacante controlar o que vira "format string" aqui — os valores variáveis (`error.status`, `error.message`) entram como argumentos, não como parte do template interpretado.

---

## npm audit

```
1 vulnerabilidade (baixa): dompurify 3.4.13-3.4.15 — ver achado [BAIXA] acima.
0 críticas, 0 altas, 0 médias.
```

---

## Segredos no histórico do git

Busquei por chaves privadas (`BEGIN PRIVATE KEY` etc.), nomes de variável de segredo com valor atribuído (`ASAAS_API_KEY=`, `MUX_TOKEN_SECRET=`, `RESEND_API_KEY=`, `CRON_SECRET=`, `SUPABASE_SERVICE_ROLE_KEY=`) e arquivos `.env`/`*.pem`/`*.key` já commitados, em todo o `git log -p --all`. **Nada encontrado.** O único arquivo de variáveis já commitado é `.env.example`, que só tem a URL pública do projeto e um placeholder (`COLE_AQUI_A_CHAVE_ANON_PUBLIC`) — sem segredo real.
