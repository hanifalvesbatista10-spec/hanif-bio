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

## Página de agradecimento da Mentoria de APH — Kiwify

Após publicar, configure no produto Mentoria de APH da Kiwify com a URL da página de agradecimento com:

https://hanifalves.vercel.app/obrigado/mentoria-aph

Salve a configuração. Se usar outro domínio, substitua apenas o domínio. O redirecionamento após aprovação é feito pela Kiwify; criar a rota no site não configura a plataforma automaticamente.

A página é pública, não cria login, não libera conteúdo e não comprova pagamento. Ela orienta o comprador a consultar seu e-mail e suas compras na Kiwify. Não utiliza parâmetros da URL como prova de aprovação.

O checkout público da Mentoria de APH é definido em src/services/productCheckout.js com o endereço autorizado https://pay.kiwify.com.br/ZvtGR1D. Esse endereço tem prioridade para o slug mentoria-aph; os demais produtos continuam usando checkout_url do Supabase. O cadastro do banco não é alterado por essa configuração.

A Mentoria de APH possui página própria em /produto/mentoria-aph. A entrada da bio leva à página, e os botões Adquirir da página levam ao checkout Kiwify. Se o catálogo público do Supabase não retornar a mentoria, withMentorship inclui sua entrada autorizada, sem duplicar um cadastro existente.
