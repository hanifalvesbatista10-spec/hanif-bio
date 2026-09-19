# Mux na área de membros — configuração

O site continua aceitando YouTube. Cada aula agora pode escolher **Mux (protegido)**: você envia o arquivo,
o Mux hospeda e o aluno só assiste com um link assinado que expira. As chaves do Mux ficam no servidor
(Vercel) e nunca chegam ao navegador.

## Ordem para ligar

1. **Supabase** → SQL Editor → rode `supabase/14_mux_video.sql` (só adiciona colunas em `product_lessons`).
2. **Mux** (dashboard.mux.com):
   - *Settings → API Access Tokens → Generate new token* com permissão **Mux Video: Read + Write**.
     Guarde o **Token ID** e o **Token Secret**.
   - *Settings → Signing Keys → Generate new key* (ambiente de produção).
     Guarde o **Key ID** e a **Private key** (já vem em base64; cole exatamente como veio).
3. **Vercel** → projeto → *Settings → Environment Variables* (Production) e adicione:

   | Variável | Valor |
   | --- | --- |
   | `MUX_TOKEN_ID` | Token ID do passo 2 |
   | `MUX_TOKEN_SECRET` | Token Secret do passo 2 |
   | `MUX_SIGNING_KEY_ID` | Key ID da chave de assinatura |
   | `MUX_SIGNING_KEY_PRIVATE` | Private key (base64) |

4. **Redeploy** (Deployments → ⋯ → Redeploy). Sem redeploy as variáveis não entram.
5. No painel: **Aulas → + Nova aula → Mux · protegido → escolher o arquivo → Salvar aula**.
   A aula aparece como “Processando no Mux” e vira “Vídeo Mux pronto” sozinha (a página consulta o Mux a cada 6 s).
   Depois é só **Publicar**. Use **Ver como aluno** para conferir.

## O que protege

- **Link assinado (JWT RS256) de curta duração (4 h).** O vídeo é criado com política `signed`: sem token válido o Mux não entrega nada.
  O link não serve para colar em outro lugar depois de expirar.
- **Token só para quem pode assistir.** `/api/mux-token` lê a aula com a sessão do próprio usuário: o RLS do Supabase só devolve a linha
  para administrador ou aluno com acesso ativo ao produto (e aula publicada). Sem acesso → 403.
- **Sem download e sem URL pública.** O ID de reprodução fica inútil sem o token. O arquivo original não é exposto.
- **Marca d'água com nome e e-mail do espectador**, em posição que muda a cada 18 s, para desestimular gravação de tela.
- **Só o administrador envia ou apaga vídeos** (`/api/mux-upload`, `/api/mux-asset` conferem `role = admin`).
- Ao **excluir uma aula** ou **substituir o vídeo**, o arquivo antigo é apagado do Mux (evita cobrança de armazenamento).

## Limites (para ser honesto)

- Nenhum player impede **gravação de tela ou de celular**. A marca d'água identifica quem vazou, não bloqueia.
- Em **tela cheia** o player ocupa a tela sozinho e a marca d'água some. Se isso for crítico, considere DRM (Mux DRM, plano específico).
- Se você **remover o acesso de um aluno**, o token que ele já abriu continua válido até expirar (no máximo 4 h). Novas aberturas são negadas na hora.
- Aulas em **YouTube** continuam com a proteção que o YouTube oferece (nenhuma além de “não listado”).
- O envio usa qualidade `basic` do Mux (a mais barata). Vídeos ficam no Mux enquanto a aula existir: monitore o uso no dashboard.

## Problemas comuns

| Mensagem | Causa |
| --- | --- |
| “Integração com o Mux não configurada” | Faltam variáveis na Vercel (a mensagem lista quais) ou faltou o redeploy. |
| “O Mux recusou as credenciais” | `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` errados ou sem permissão de escrita. |
| “O banco ainda não está pronto para o Mux” | Falta rodar `supabase/14_mux_video.sql`. |
| Aula fica em “Processando” | Clique em **Atualizar status**. Se virar “Erro no Mux”, envie o vídeo de novo (formato/áudio inválido). |
| “As funções do Mux não estão disponíveis neste ambiente” | Você está no `npm run dev`. As funções `/api` só existem no site publicado (ou com `vercel dev`). |
