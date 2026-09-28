# Checkout próprio (InfinitePay para Pix e cartão, Asaas para boleto)

O comprador paga na página `/checkout/<endereço-do-produto>` do seu site e escolhe:

- **Pix ou cartão**: vai para a página segura da **InfinitePay**, onde escolhe Pix ou cartão e, no cartão,
  **em quantas parcelas quer pagar (até 12x)**. O juro do parcelamento fica com o comprador (veja "Juro do
  parcelamento" abaixo). O Pix não tem taxa. Depois de pagar, ele volta ao seu site.
- **Boleto**: gerado pelo **Asaas** dentro do seu site (linha digitável e PDF).

Quando o pagamento é confirmado, o site marca o pedido como pago e libera o curso na conta do aluno. Nada muda no
site até você ligar o checkout próprio em um produto.

## O que existe

| Peça | Onde |
| --- | --- |
| Página de compra e de confirmação | `/checkout/:slug` e `/checkout/obrigado` |
| Criar pedido e cobrança | `api/checkout-create.js` |
| Acompanhar o status (e conferir o retorno da InfinitePay) | `api/checkout-status.js` |
| Aviso de pagamento da InfinitePay (Pix e cartão) | `api/infinitepay-webhook.js` |
| Aviso de pagamento do Asaas (boleto) | `api/asaas-webhook.js` |
| Testar a configuração (botão em Pedidos) | `api/checkout-diagnose.js` |
| Painel de vendas | `/admin/pedidos` |
| Banco (pedidos, avisos, liberação ao criar conta) | `supabase/19_checkout_proprio.sql` |

## Segurança já embutida

- O **valor cobrado é lido do banco** (o navegador não decide preço).
- O aviso de pagamento da InfinitePay **não tem assinatura**, então o site **nunca confia no que vem nele**:
  cada pagamento é **conferido de volta na InfinitePay** antes de liberar o curso. Um aviso falso não confirma nada.
- O valor confirmado precisa cobrir o preço do produto (o juro do parcelamento, pago pelo comprador, vem por cima).
- Cada pagamento é processado **uma vez**. A chave do Asaas e a `service_role` do Supabase só existem no servidor.
- O número do cartão nunca passa pelo seu servidor (ele é digitado na página da InfinitePay).

## Juro do parcelamento (por conta do comprador)

Quem decide isso é a **sua conta na InfinitePay**, não o site. No app da InfinitePay (Vendas → Checkout →
Configurações), ative o **Checkout Integrado** e a opção de **repassar as taxas ao cliente**. Assim, quando o comprador
escolhe parcelar, a InfinitePay mostra as parcelas já com o juro, e você recebe o valor do curso.

Confira no primeiro teste: no cartão em 2x ou mais, o total mostrado ao comprador deve ser **maior** que o preço do
curso. Se aparecer o mesmo valor, a opção de repasse não está ligada na conta. O pedido no site continua registrado
com o preço do curso (o valor pago a mais é o juro).

## Passo a passo para ligar

1. **SQL**: no Supabase, SQL Editor, rode `supabase/19_checkout_proprio.sql` (e `supabase/20_cupons.sql`, se for usar cupons).
2. **InfinitePay**: no app, ative o **Checkout Integrado** (Vendas → Checkout → Configurações) e a opção de
   repassar as taxas ao cliente. Anote a sua **InfiniteTag** (o nome que aparece no app, sem o `$`).
3. **Variáveis na Vercel** (*Settings → Environment Variables*), depois um **redeploy**:

   | Variável | Valor |
   | --- | --- |
   | `INFINITEPAY_HANDLE` | a sua InfiniteTag, sem o `$` (não é segredo) |
   | `SITE_URL` | o endereço do site, ex.: `https://www.aphhardcore.com` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (só na Vercel, nunca em conversa) |
   | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENV` | só para o **boleto** (veja `Boleto` abaixo) |

   Não precisa criar webhook na InfinitePay: o site envia o endereço do aviso junto com cada link de pagamento.
4. **Produto**: em *Produtos → editar*, "Como este produto é vendido", escolha **Checkout do próprio site** e confira o
   preço (o promocional, se houver, é o cobrado).
5. **Teste**: em *Pedidos → Testar conexão*, confira que aparece a InfinitePay configurada.

### Boleto (Asaas)

O boleto continua no Asaas: chave de API (`ASAAS_API_KEY`), um token de webhook inventado por você
(`ASAAS_WEBHOOK_TOKEN`, o mesmo cadastrado no Asaas) e, se a chave de testes não tiver `hmlg` no começo,
`ASAAS_ENV=sandbox`. No Asaas, crie o webhook de cobranças para `https://SEU-DOMINIO/api/asaas-webhook`
com os eventos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`,
`PAYMENT_CHARGEBACK_REQUESTED`. Se você não quiser boleto, é só não configurar essas variáveis (a opção Boleto
continua aparecendo, mas avisa que não está disponível; me peça para tirá-la da tela).

## Como testar

A InfinitePay não tem ambiente de testes: o teste é uma **compra real de valor pequeno**.

1. Crie um produto de teste com o **preço mínimo (R$ 5,00)**, em **Checkout do próprio site**, e deixe ativo só
   enquanto testa.
2. Compre pelo **Pix** (grátis) e confira: o pedido aparece em *Pedidos*, vira *Pago*, e o curso aparece na área do aluno.
3. Compre pelo **cartão em 1x e em 2x ou mais**: confira se o total do parcelado tem o juro.
4. Peça o estorno no app da InfinitePay e use **Marcar como reembolsado** em *Pedidos*.
5. Desative ou apague o produto de teste.

## Parcelamento em destaque nos preços

Em **Produtos**, o cartão "Parcelamento em destaque nos preços" liga a frase **"12x de R$ 29,30"** (com o juro que o comprador paga) e o valor à vista nos preços dos produtos com checkout do site, na página do produto, na home e no resumo do checkout (já com o cupom aplicado). Antes, rode `supabase/28_parcelamento_em_destaque.sql`.

- **Juro:** é o percentual total que o cartão em N parcelas custa a mais que o preço à vista. Para descobrir, faça um checkout de teste, escolha o cartão em 12x e anote o preço e o total que a InfinitePay mostra; o painel calcula o percentual ("Calcular o juro").
- **Confira de vez em quando:** se a InfinitePay mudar a taxa da sua conta, o valor mostrado no site fica desatualizado até você refazer o teste e salvar.
- **Desligar:** deixe o juro em branco ("Desligar destaque"). Sem o SQL 28 ou com o juro vazio, nada é exibido.
- O texto sempre informa "com juros" e o total no cartão, como exige o Código de Defesa do Consumidor. Parcela abaixo de R$ 5,00 não é anunciada.

## Cupons de desconto

Em **Cupons** (menu do painel) você cria códigos para o checkout do site. Antes, rode `supabase/20_cupons.sql` no Supabase.

- **Desconto:** em porcentagem (1 a 100%) ou valor fixo em R$.
- **Vale para:** todos os produtos com checkout do site, ou um produto só.
- **Prazo:** data de início e de fim (opcionais). O cupom vale até o fim do dia escolhido, no horário de Brasília.
- **Limite:** número total de usos (opcional) e "cada pessoa usa uma vez" (por e-mail ou CPF, ligado por padrão).
- **Forma de pagamento:** o cupom pode valer para todas as formas, só para **Pix ou cartão** ou só para **boleto**. Antes, rode `supabase/27_cupom_por_forma_de_pagamento.sql`. Pix e cartão andam juntos porque o comprador escolhe entre eles na página da InfinitePay, depois de o pedido ser criado; separar os dois exigiria outro provedor de Pix. No checkout, se o comprador trocar de forma de pagamento, o cupom é conferido de novo (e sai se não valer para a nova forma). O servidor confere a regra ao criar o pedido.
- **Link pronto:** em cupons de um produto, o botão **Copiar link** gera `/checkout/<produto>?cupom=CODIGO`, que já abre com o desconto aplicado.
- **Cupom de 100%:** libera o acesso **na hora, sem cobrança** (bom para presentear alunos). Quem tem o código tem o curso, então
  use sempre o **limite de usos** e a data final, e desative o cupom quando terminar.

Como funciona por dentro: o comprador digita o código e vê a prévia do desconto, mas o valor de verdade é **recalculado no
servidor** quando ele paga (mexer na tela não muda o preço). O pedido guarda o cupom, o desconto e o preço de tabela, e
aparece em *Pedidos* como "cupom CODIGO (−R$ ...)". Um pedido "aguardando" segura o cupom por 1 hora; pedido que falhou não conta.

Regras que o site impõe: o valor final não pode ficar entre R$ 0,01 e R$ 4,99 (o gateway não aceita cobranças tão baixas;
ou é grátis ou pelo menos R$ 5,00). O desconto de um cupom fixo maior que o preço vira grátis. O parcelamento com juros do
cartão continua funcionando por cima do valor já com desconto.

## Recuperação de vendas (carrinho abandonado e pagamento recusado)

Menu **Recuperação de vendas** (rode `supabase/29_recuperacao_de_vendas.sql` uma vez). Reúne quem começou a comprar e não
terminou (pedido "Aguardando" sem pagar) e quem teve o cartão recusado, para você tentar recuperar a venda.

- **E-mails automáticos** (opcional, você liga em Recuperação de vendas): manda 1 lembrete pouco depois do abandono
  (ou do pagamento recusado) e, se ainda não pagou, 1 último lembrete no dia seguinte. Nunca manda para quem já pagou
  (a busca sempre exclui pedidos pagos) nem para quem clicou em "não quero mais receber" no e-mail. Você pode anexar
  um **cupom de desconto** (precisa existir em Cupons) que entra pronto no link do e-mail.
- **Exige estas variáveis na Vercel**, depois um redeploy: `RESEND_API_KEY` e `RESEND_FROM` (conta na Resend, a mesma
  do login por e-mail — crie uma chave de API própria, o SMTP do login não serve para isto), `SITE_URL` (já deve
  existir) e `CRON_SECRET` (invente uma senha longa qualquer; protege a rota do robô).
- **Frequência**: o robô roda pela Vercel (`vercel.json → crons`) **uma vez por dia** no plano gratuito da Vercel — é o
  limite do plano Hobby, não do site. Isso ainda recupera vendas, mas o ideal (lembrete em poucas horas, enquanto o
  comprador está "quente") pede lembretes mais frequentes. Para isso, sem custo: crie uma conta grátis em um
  agendador externo como o **cron-job.org**, e configure-o para chamar
  `https://www.aphhardcore.com/api/cron-recover-sales` a cada 20-30 minutos, com o cabeçalho
  `Authorization: Bearer <CRON_SECRET>`. É seguro chamar várias vezes: cada pedido só recebe cada lembrete uma vez.
- **WhatsApp**: não é automático. A tabela em Recuperação de vendas tem um botão **Copiar mensagem de WhatsApp**
  (com o link de pagamento e o cupom, se houver) para quem deixou o telefone — você que manda. A API oficial do
  WhatsApp (Meta) permite automatizar, mas exige criar uma conta comercial na Meta, verificar a empresa, registrar um
  número e ter modelos de mensagem aprovados; depois de uma cota mensal grátis, cada conversa iniciada por você é
  cobrada (por volta de R$ 0,03 a R$ 0,40, dependendo do tipo de mensagem). Se um dia quiser automatizar de verdade,
  é um projeto à parte — peça para configurar depois de criar a conta na Meta.
- **"Não quero mais receber"**: o rodapé do e-mail tem um link que marca o pedido para nunca mais entrar na
  recuperação (não afeta os outros e-mails do site, como confirmação de cadastro).

## Estorno e reembolso

- **Pix e cartão (InfinitePay):** faça o estorno no app da InfinitePay. Ela não avisa o site, então use
  **Pedidos → Marcar como reembolsado** para tirar o acesso do aluno.
- **Boleto (Asaas):** estorne no Asaas; o aviso marca o pedido como reembolsado e tira o acesso sozinho.

## O que a Kiwify/Hotmart faziam e agora é com você

- **Nota fiscal e impostos**: converse com o seu contador sobre a emissão para vendas no seu CPF/CNPJ.
- **Política de reembolso e termos de compra**: em compras online vale o direito de arrependimento em 7 dias
  (Código de Defesa do Consumidor); vale ter uma página com a sua política e a de privacidade (LGPD).
- **Afiliados, order bump e assinaturas**: não fazem parte desta primeira versão.
- **Carrinho abandonado**: pedidos "Aguardando" que nunca pagam ficam listados em Pedidos e em **Recuperação de
  vendas**, com lembrete automático por e-mail (veja a seção abaixo).

## Problemas comuns

- *"Checkout ainda não configurado no servidor (faltam: ...)"*: falta variável na Vercel ou o redeploy.
- *"Não foi possível iniciar o pagamento"*: use **Pedidos → Testar conexão**. Costuma ser a InfiniteTag errada ou o
  Checkout Integrado desativado no app. O motivo real também fica no log da função na Vercel.
- *Pagou e o pedido continua "Aguardando"*: a página de obrigado confere o pagamento na hora quando o comprador volta
  da InfinitePay; se ele fechou a página antes, o aviso da InfinitePay confirma logo depois. Se não confirmar, veja o
  log de `/api/infinitepay-webhook` na Vercel e use **Liberar acesso** em Pedidos.
- *O parcelado não mostra juro*: a opção de repassar as taxas ao cliente não está ligada na conta da InfinitePay.
- *Comprou mas não vê o curso*: entrou com um e-mail diferente do da compra. Use **Pedidos → Liberar acesso** ou
  **Acessos dos alunos**.
