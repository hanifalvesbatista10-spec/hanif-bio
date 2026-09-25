# Guia de operação do site (dia a dia)

Endereço principal: **https://www.aphhardcore.com** (a raiz `aphhardcore.com` redireciona para o `www`).
Guias detalhados: `docs/checkout.md` (vendas, cupons, InfinitePay e Asaas) e `docs/login-e-emails.md` (login e e-mails).

## Ao trocar o endereço do site (feito em 09/2026)

1. **Vercel → Environment Variables:** `SITE_URL` = `https://www.aphhardcore.com`, e depois **redeploy**.
2. **Supabase → Authentication → URL Configuration:** Site URL `https://www.aphhardcore.com` e Redirect URLs `https://www.aphhardcore.com/**`.
3. Sempre use o endereço **com `www`** nesses lugares. O redirecionamento da raiz é bom para quem digita o endereço, mas avisos
   automáticos (como o de pagamento) muitas vezes não seguem redirecionamento.
4. **DNS do e-mail (Resend):** DKIM e SPF publicados. Falta/recomendado um TXT `_dmarc` com
   `v=DMARC1; p=none; rua=mailto:seu-email@aphhardcore.com`.
5. Quem estava logado no endereço antigo precisa entrar de novo (a sessão é por endereço). O endereço antigo continua no ar.
6. Opcional: trocar a URL do webhook do boleto no Asaas para `https://www.aphhardcore.com/api/asaas-webhook`.

## Conferir que tudo funciona

- **Cadastro:** crie uma conta de teste com um Gmail seu. O e-mail deve chegar (veja o spam) e o link deve abrir o `www`.
- **Esqueci minha senha:** o link deve chegar e levar à tela de nova senha; usado uma segunda vez, mostra "link vencido".
- **Pedidos → Testar conexão:** deve dizer que a InfinitePay está OK.
- **Compra de teste:** produto de R$ 5,00 com "Checkout do próprio site"; compre por Pix e por cartão parcelado. O pedido deve virar
  "Pago", o curso deve aparecer, e o cartão parcelado deve mostrar o juro. Estorne no app da InfinitePay e use
  **Marcar como reembolsado**.

## Rotinas

- **Vender um produto:** Produtos → editar → "Como este produto é vendido" → Checkout do próprio site, com preço e status Ativo.
- **Quando alguém compra:** o site confirma o pagamento e libera o curso na conta com o **mesmo e-mail da compra**. Sem conta ainda:
  o curso aparece quando ele criar uma com esse e-mail. E-mail diferente: Pedidos → menu **⋯** → **Liberar acesso**.
- **Cupons:** menu Cupons. Cupom de 100% dá acesso grátis: use sempre limite de usos e data final.
- **Aluno que não consegue entrar:** Usuários → menu **⋯** da linha → **Enviar link de nova senha** ou **Reenviar e-mail de confirmação**.
- **Certificados:** Certificados → Emitir → Alunos cadastrados (CPF, RG e foto vêm de Configurações → Meus dados, preenchidos pelo aluno).
- **Estorno:** Pix e cartão no app da InfinitePay + Pedidos → **⋯** → **Marcar como reembolsado**; boleto no Asaas (o aviso tira o acesso).

## Onde olhar quando algo der errado

| Sintoma | Onde ver |
| --- | --- |
| Não consigo criar pagamento | Pedidos → **Testar conexão** (mostra o motivo exato) |
| E-mail não chegou | Painel do **Resend → Logs** (enviou, entregou ou recusou) |
| Pagou e não liberou | Pedidos (status) e **Liberar acesso** |
| Erro em uma função do site | **Vercel → Logs** |
| Login com erro estranho | **Supabase → Authentication → Logs** |

## Segredos (nunca em conversa, print ou código)

`SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e a chave de API do Resend ficam só na Vercel e no
Supabase. Se algum vazar, gere outro e troque.

## Variáveis na Vercel (resumo)

`INFINITEPAY_HANDLE`, `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; para o boleto: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`
e, se a chave de testes não tiver `hmlg`, `ASAAS_ENV`. Mux (vídeos protegidos): veja `docs/mux-setup.md`.

## Migrações do banco já criadas (rodar no SQL Editor, na ordem)

`17_certificados_paginas`, `18_dados_do_aluno`, `19_checkout_proprio`, `20_cupons` (as anteriores, 01 a 16, já foram executadas).

## Saúde do projeto

- **Mensalmente:** confira o uso do plano do Resend (e-mails) e do Supabase (banco e arquivos). No plano gratuito o Supabase pausa
  projetos parados por muito tempo e não guarda backups de longo prazo: **exporte os dados de vez em quando**.
- **Antes de vender de verdade:** nota fiscal (converse com o contador), política de reembolso e páginas de termos e privacidade
  (o cadastro pede o aceite, mas essas páginas ainda não existem no site).

## Aplicativo (PWA): o site instalável no celular

O site é um PWA: o aluno instala pelo navegador e ganha um ícone na tela inicial, que abre em tela cheia direto na Área do aluno.

- **Como o aluno instala:** no Android (Chrome) aparece um aviso "Instale o app" em Meus cursos e o item "Instalar aplicativo" no menu da conta;
  também dá pelo menu do Chrome ("Instalar app"). No iPhone: Safari → Compartilhar → "Adicionar à Tela de Início".
- **Atualizações:** o app carrega o site da internet, então tudo o que você publica na Vercel aparece nele sozinho. Não há loja nem versão para publicar.
- **O que fica guardado no aparelho:** só arquivos que não mudam (scripts com hash, fontes, ícones) e a tela "Você está sem internet".
  Páginas, dados do aluno, vídeos e chamadas `/api` nunca ficam guardados.
- **Arquivos:** `public/manifest.webmanifest` (nome, cores, ícones), `public/icons/`, `public/sw.js` (service worker) e `public/offline.html`.
  Para trocar o ícone ou o nome do app, edite o manifesto e os ícones. Se mudar o `sw.js`, aumente o `VERSION` no topo dele.
- **Testar:** depois do deploy, abra o site no Chrome do Android, entre na Área do aluno e confira o aviso de instalar. Ative o modo avião
  com o app aberto e abra outra página: deve aparecer "Você está sem internet".
- **Próximo passo (opcional):** para aparecer na Play Store, dá para empacotar este mesmo PWA como TWA. Confira antes as regras de pagamento do Google.
