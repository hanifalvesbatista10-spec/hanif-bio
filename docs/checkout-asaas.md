# Checkout próprio com o Asaas (Pix, boleto e cartão)

O comprador paga na página `/checkout/<endereço-do-produto>` do seu site.

- **Pix e boleto** aparecem inteiros dentro do seu site (QR code, "copia e cola", linha digitável).
- **Cartão de crédito**: o comprador é levado à página segura do Asaas para digitar o cartão e volta ao seu site
  depois de pagar. O número do cartão nunca passa pelo seu servidor (isso evita as exigências de segurança de
  cartão, PCI). O Asaas também permite receber o cartão direto no site, mas aí o dado do cartão passaria pelo seu
  servidor; por isso a primeira versão usa a página do Asaas.

Quando o pagamento é **confirmado** (aviso do Asaas para o seu servidor), o site marca o pedido como pago e libera o
curso na conta do aluno. Nada muda no site até você ligar o checkout próprio em um produto.

## O que existe

| Peça | Onde |
| --- | --- |
| Página de compra e de confirmação | `/checkout/:slug` e `/checkout/obrigado` |
| Criar pedido e cobrança | `api/checkout-create.js` |
| Acompanhar o status | `api/checkout-status.js` |
| Confirmar pagamento (webhook do Asaas) | `api/asaas-webhook.js` |
| Painel de vendas | `/admin/pedidos` |
| Banco (pedidos, avisos, liberação ao criar conta) | `supabase/19_checkout_proprio.sql` |

Regras de segurança já embutidas: o **valor é lido do banco** (o navegador não decide preço), o pagamento só vale
quando o **token do webhook** confere e o valor pago cobre o pedido, cada aviso é processado **uma vez**, e a chave
do Asaas e a `service_role` do Supabase só existem no servidor.

## Passo a passo para ligar

Comece **sempre pelo ambiente de testes (sandbox)** do Asaas: ele tem conta e chave próprias, separadas da real.

1. **Conta**: crie a conta real em asaas.com (aceita CPF ou CNPJ/MEI) e a conta de testes em sandbox.asaas.com.
2. **Pix**: na conta real, ative o Pix (cadastre a sua chave Pix no Asaas). O boleto e o cartão seguem as regras de
   aprovação da conta do Asaas.
3. **SQL**: no Supabase, SQL Editor, rode `supabase/19_checkout_proprio.sql`.
4. **Chave de API**: no painel do Asaas (procure "Integrações" / "Chaves de API"), gere a chave.
   As chaves do sandbox começam com `$aact_hmlg_`; o site detecta isso e usa o ambiente de testes sozinho.
5. **Variáveis na Vercel** (*Settings → Environment Variables*):

   | Variável | Valor |
   | --- | --- |
   | `ASAAS_API_KEY` | a chave de API (sandbox primeiro, depois a real) |
   | `ASAAS_WEBHOOK_TOKEN` | uma senha longa que **você inventa** (32+ caracteres). Não use a chave do Asaas aqui |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |
   | `SITE_URL` (opcional) | o endereço do site, ex.: `https://hanifalves.vercel.app`, usado no retorno do cartão |

   Nunca cole essas chaves em conversa, e-mail ou no código. A `service_role` dá acesso total ao banco: só na Vercel.
   Se a chave do Asaas (que começa com `$`) vier cortada ao colar, coloque-a entre aspas simples.
6. **Webhook**: no Asaas (procure "Integrações" / "Webhooks") crie um webhook de **cobranças**:
   - URL: `https://SEU-DOMINIO/api/asaas-webhook`
   - Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`,
     `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`
   - Fila de envio ativa (se o webhook falhar muitas vezes seguidas, o Asaas pode pausá-lo).
7. **Retorno do cartão**: para o comprador voltar ao seu site depois de pagar no Asaas, o domínio do site precisa estar
   cadastrado na conta do Asaas (*Configurações da conta → Informações*). Sem isso o pagamento funciona do mesmo jeito;
   só não há o retorno automático (o comprador vê "pago" no Asaas e o acesso é liberado normalmente).
8. **Redeploy** na Vercel (as variáveis só valem no deploy seguinte).
9. **Produto**: em *Produtos → editar*, em "Como este produto é vendido", escolha **Checkout do próprio site** e
   confira o preço (o promocional, se houver, é o cobrado). Salve.

## Como testar (sandbox, sem cobrar de verdade)

Faça uma compra de teste de **cada** forma de pagamento e confira:

1. o pedido aparece em **Pedidos** como *Aguardando*;
2. depois de pago (no sandbox você pode simular o pagamento pelo painel do Asaas, na cobrança), o pedido vira *Pago*;
3. o curso aparece na área do aluno (mesmo e-mail da compra);
4. quem ainda não tinha conta recebe o curso ao criar a conta com o mesmo e-mail;
5. o Pix: a página do QR code segue sozinha para "Pagamento confirmado" quando o pagamento cai.

Só depois troque a chave do sandbox pela real (e crie o webhook também na conta real).

## Estorno

Faça no painel do Asaas (na cobrança). O webhook marca o pedido como **reembolsado** e tira o acesso do aluno.
Estorno parcial não tira o acesso. Chargeback (contestação do cartão) também tira o acesso.

## O que a Kiwify/Hotmart faziam e agora é com você

- **Nota fiscal e impostos**: converse com o seu contador sobre a emissão para vendas no seu CPF/CNPJ.
- **Política de reembolso e termos de compra**: em compras online vale o direito de arrependimento em 7 dias
  (Código de Defesa do Consumidor); vale ter uma página com a sua política e a de privacidade (LGPD).
- **Afiliados, cupons, order bump e assinaturas**: não fazem parte desta primeira versão.
- **Carrinho abandonado**: pedidos "Aguardando" que nunca pagam ficam listados em Pedidos; boletos vencidos passam a
  "Cancelado". Hoje não há e-mail automático de recuperação.
- **E-mails ao comprador**: o Asaas envia as notificações de cobrança dele (você controla isso no painel do Asaas).
  O site em si não envia e-mails.

## Problemas comuns

- *"Checkout ainda não configurado no servidor (faltam: ...)"*: falta variável na Vercel ou o redeploy.
- *O pagamento foi feito mas o pedido continua "Aguardando"*: o aviso não chegou. Veja no Asaas o histórico do webhook;
  confira a URL, o token (igual ao `ASAAS_WEBHOOK_TOKEN`) e os eventos.
- *"Não foi possível iniciar o pagamento"*: a chave está errada ou o ambiente não bate (chave do sandbox no site real,
  ou o contrário). Veja o log da função na Vercel.
- *Comprou mas não vê o curso*: entrou com um e-mail diferente do da compra. Use **Pedidos → Liberar acesso** ou
  **Acessos dos alunos**.
