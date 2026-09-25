# Guia de operação do site (dia a dia)

Endereço principal: **https://www.aphhardcore.com** (a raiz `aphhardcore.com` redireciona para o `www`).
Guias detalhados: `docs/checkout.md` (vendas, cupons, InfinitePay e Asaas), `docs/login-e-emails.md` (login e e-mails) e `docs/provas-e-atividades.md` (provas, simulados e tarefas).

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

## Aulas compartilhadas entre cursos

Uma aula pode aparecer em vários cursos (rode `supabase/22_aulas_compartilhadas.sql` uma vez). No painel, **Aulas**:
- **Nova aula** e **Editar** têm a seção **Em quais cursos esta aula aparece**: marque os cursos. A aula é uma só: mudar o vídeo, o texto ou tirar do ar vale para todos.
- **Adicionar aula de outro curso** (no topo) reaproveita aulas que já existem, sem subir o vídeo de novo.
- Cada curso tem a **sua ordem** (setas ↑ ↓ mexem só no curso aberto). A aula nova entra no fim da lista dos outros cursos.
- No menu **⋯** da aula: **Tirar só deste curso** (ela continua nos outros) e **Excluir de todos os cursos**. Aulas compartilhadas mostram "Também em: ...".
- Quem tem acesso a **qualquer** curso da aula assiste. Os **comentários** ficam na aula, então os alunos de todos os cursos veem os mesmos.
- Apagar um curso não apaga aulas que estão em outros cursos.

## Depoimentos por link

Em **Feedbacks → Pedir depoimento por link** (rode `supabase/24_depoimentos_por_link.sql` uma vez):
1. Escolha o curso e, se quiser, o **nome do aluno** (link pessoal: já vem com o nome e vale uma vez). Sem nome, o link é geral (várias pessoas, ex.: uma turma).
   Dá para limitar por dias. Clique em **Criar link e copiar mensagem** e cole no WhatsApp.
2. O aluno abre a página, coloca nome, nota de 1 a 5 estrelas, o depoimento (mínimo de 20 letras), foto e, se quiser, resultado e vídeo. Marca se **autoriza** a publicação.
3. O depoimento chega em **Feedbacks** como **Em análise**, com a etiqueta "Recebido pelo link". Nada aparece no site sozinho.
4. Clique em **Revisar** (ajuste o texto se precisar) e **Publicar no site**. Se o aluno não marcou a autorização, o painel avisa antes de publicar.
- No menu **⋯** do link: copiar só o link, enviar pelo WhatsApp, desligar, excluir. O link vale enquanto estiver ligado, dentro do prazo e sem passar do limite de usos.
- A foto do aluno só é aceita com um link ativo, até 1 MB e só imagem. Depoimentos e fotos enviados por link nunca entram no site antes de você publicar.
- A página do aluno não aparece no Google (`noindex`).

## Desempenho do aluno (onde ele está errando)

**Usuários → Desempenho** (botão ao lado de cada aluno; rode `supabase/25_subtema_das_questoes.sql` uma vez para usar o subtema). A ficha junta todas as provas, simulados e tarefas do aluno:
- **Cartões:** média geral (e se está subindo ou caindo), envios e aprovações, dias desde a última atividade e quantos temas estão abaixo de 60%.
- **Onde está acertando e errando:** cada **tema** (RCP, Trauma...) com o aproveitamento e, dentro dele, cada **subtema** (a parte específica, como "B - Respiração" ou "C - Circulação"). Os mais fracos vêm primeiro: Reforçar (abaixo de 60%), Atenção (60 a 79%), Forte (80% ou mais). Com menos de 3 respostas no assunto aparece "poucos dados".
- **Ver questões:** ao lado de cada tema ou subtema, mostra as questões que ele errou, com o que respondeu, o gabarito e a explicação. Uma questão errada mais de uma vez fica no topo.
- **Histórico** de todos os envios (com link para a resposta) e **Ainda não fez** (atividades abertas para ele).
- **Copiar resumo** gera um texto curto para conversar com o aluno, e **Chamar no WhatsApp** abre a conversa.
- O aviso "Precisa de atenção" aparece com média abaixo de 60% (a partir de 2 envios), mais de 14 dias parado com atividade pendente, ou desempenho caindo.

**Para a ficha ficar rica**, preencha **Tema** e **Subtema** nas perguntas (ao importar com IA use `TEMA:` e `SUBTEMA:`; o botão "Copiar instruções para a IA" já pede isso). Use sempre a mesma grafia: o editor sugere os nomes já usados. Ignora questões anuladas, sem pontos e discursivas ainda sem nota. Só entram alunos que responderam logados.

## Desempenho da turma e "Meu desempenho" do aluno

Rode `supabase/26_desempenho_turma_e_aluno.sql` uma vez.

**Desempenho da turma** (menu Engajamento → Desempenho da turma). Escolha a turma (todos os alunos ou os alunos de um curso):
- **Cartões:** quantos alunos já responderam, média da turma, aprovação e quantos precisam de atenção.
- **Onde a turma está errando:** temas e subtemas do mais fraco ao mais forte, com "N de M alunos erraram". "Ver questões" filtra as perguntas daquele assunto.
- **Questões que mais derrubam a turma** (mínimo de 3 respostas): % que errou, a resposta errada mais marcada, o gabarito e a explicação. Se quase todo mundo erra (70% ou mais), o site sugere rever a aula ou conferir o enunciado e o gabarito.
- **Alunos:** situação de cada um (em dia, média baixa, parado há mais de 14 dias, nenhuma prova ainda) e o link para a ficha.
- **Comparação entre provas:** a média de cada prova, da mais antiga para a mais nova.

**Ligar assunto a aula.** No cadastro da aula, o campo **Temas que esta aula ensina** (um por linha): `Trauma` ou `Trauma > B - Respiração`, com os mesmos nomes de Tema e Subtema das perguntas. Com isso o painel mostra **"Aula para indicar/reforçar"** ao lado dos assuntos fracos (na turma e na ficha do aluno) e o resumo copiável inclui "Vale rever".

**Meu desempenho (aluno)**: na área do aluno, aba **Atividades → Meu desempenho**. Mostra a média, o que precisa reforçar (abaixo de 60%, com o botão para rever a aula ligada ao assunto), os pontos fortes (80% ou mais) e todos os assuntos. Conta **só provas com resultado já liberado**, então nada aparece antes da sua liberação. Assuntos precisam de pelo menos 3 respostas para entrar como ponto fraco.

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

`17_certificados_paginas`, `18_dados_do_aluno`, `19_checkout_proprio`, `20_cupons`, `21_provas_e_atividades`, `22_aulas_compartilhadas`, `23_fechar_funcoes_internas`, `24_depoimentos_por_link`, `25_subtema_das_questoes`, `26_desempenho_turma_e_aluno` (as anteriores, 01 a 16, já foram executadas). Guia das provas: `docs/provas-e-atividades.md`.

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
