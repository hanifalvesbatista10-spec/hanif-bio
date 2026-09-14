# Hanif Alves Bio — Plataforma

Projeto React/Vite com site público preservado e fundação de autenticação, área do aluno e painel administrativo via Supabase.

Leia primeiro: `PASSO_A_PASSO_LEIGO.txt`.

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Banco

Execute `supabase/01_setup_completo.sql` no SQL Editor do Supabase.

## Página de agradecimento Hotmart

Após publicar, configure no produto da Hotmart em “Página de obrigado e upsell” o campo “Cartão ou Pix aprovado” com:

https://hanifalves.vercel.app/obrigado/controle-de-hemorragias

Salve a configuração. Se usar outro domínio, substitua apenas o domínio. O redirecionamento após aprovação é feito pela Hotmart; criar a rota no site não configura a plataforma automaticamente.

A página é pública, não cria login, não libera conteúdo e não comprova pagamento. Ela orienta o comprador a consultar seu e-mail e suas compras na Hotmart. Não utiliza parâmetros da URL como prova de aprovação.

A landing /produto/controle-de-hemorragias continua lendo checkout_url e preços do produto ativo no Supabase. Depoimentos aparecem apenas quando publicados, autorizados e vinculados ao produto.
