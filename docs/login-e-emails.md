# Login dos alunos: e-mails, senha e configuração do Supabase

## Por que o aluno "não recebia" o e-mail de senha

Enquanto o Supabase usa o **servidor de e-mail padrão dele**, ele só entrega mensagens para os **membros da equipe do
projeto**. Para qualquer outro endereço (os seus alunos) o envio falha com "Email address not authorized". Além disso o
servidor padrão tem limite muito baixo (poucas mensagens por hora) e é só para demonstração.

Isso vale para **todo** e-mail do login: link de **redefinir senha**, **confirmação de cadastro** e reenvios. Sem configurar
um servidor de e-mail próprio (SMTP), nenhum aluno consegue receber o link, e nenhuma mudança no site resolve isso sozinha.

## O que precisa ser feito no Supabase (uma vez)

Tudo no painel do Supabase, em **Authentication**.

### 1. Servidor de e-mail próprio (SMTP) — o mais importante

*Authentication → Emails → SMTP Settings → Enable Custom SMTP.*

Escolha um provedor de e-mail transacional e copie os dados SMTP dele (servidor, porta, usuário, senha):

- **Resend**, **Brevo**, **Amazon SES**, **SendGrid** ou **Mailgun**. Vários têm plano gratuito suficiente para começar.
- Para o e-mail não cair no spam, o remetente deve ser de um **domínio seu** (ex.: `nao-responda@seudominio.com.br`), com os
  registros DNS do provedor (SPF e DKIM) configurados. Com `vercel.app` não dá para autenticar o remetente; se você ainda
  não tem domínio próprio, um remetente único verificado (Brevo, por exemplo) funciona para começar, com mais risco de spam.
- Preencha **Sender email** (remetente) e **Sender name** (ex.: "Hanif Alves").
- Depois de salvar, ajuste o limite em *Authentication → Rate Limits* (e-mails por hora) para o seu volume.

### 2. Endereços permitidos (URL Configuration)

*Authentication → URL Configuration.*

- **Site URL:** `https://hanifalves.vercel.app` (ou o seu domínio próprio, quando tiver).
- **Redirect URLs** (lista de permitidos), adicione:
  - `https://hanifalves.vercel.app/**`
  - `http://localhost:5173/**` (só se for testar no seu computador)

Sem isso, o link do e-mail leva à página errada ou é recusado.

### 3. Regras de senha e confirmação

*Authentication → Sign In / Providers → Email.*

- **Confirm email:** ligado (o aluno confirma o e-mail antes de entrar).
- **Minimum password length:** 8.
- **Prevent use of leaked passwords:** ligue se o seu plano tiver a opção (bloqueia senhas que já vazaram na internet).

### 4. Mensagens em português (opcional, recomendado)

*Authentication → Emails → Templates.* Modelos prontos:

**Confirm signup**
- Assunto: `Confirme o seu e-mail`
- Corpo:
```html
<h2>Confirme o seu e-mail</h2>
<p>Olá! Para ativar a sua conta na área do aluno, clique no botão abaixo:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a></p>
<p>Se você não criou uma conta, ignore esta mensagem.</p>
```

**Reset password**
- Assunto: `Crie uma nova senha`
- Corpo:
```html
<h2>Crie uma nova senha</h2>
<p>Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo (o link vale por 1 hora):</p>
<p><a href="{{ .ConfirmationURL }}">Criar nova senha</a></p>
<p>Se não foi você, ignore esta mensagem: a sua senha continua a mesma.</p>
```

## O que o site já faz (depois de configurar o e-mail)

- **Esqueci minha senha** no login, com o passo a passo: pede o e-mail, envia o link (válido por 1 hora), abre a tela de nova
  senha e leva o aluno para a área dele. A resposta é a mesma exista ou não a conta (ninguém descobre quem é aluno).
- **Link vencido ou já usado:** o site explica e oferece pedir outro.
- **Cadastro:** confere nome completo, senha (mín. 8, com letras e números, sem senhas óbvias) e aceite; avisa quando o e-mail
  já tem conta; mostra a tela "confirme o seu e-mail" com botão para reenviar.
- **Login:** mensagens em português, mostrar/ocultar senha, reenviar confirmação, pausa de 30 s depois de 5 erros seguidos.
- **Área do aluno → Meus dados → Segurança:** trocar a senha (pede a atual) e **sair de todos os aparelhos**.
  Trocar ou redefinir a senha desconecta os outros aparelhos.
- **Se o perfil não carregar:** em vez de voltar ao login sem explicação, mostra o erro com "Tentar de novo".
- **Painel → Usuários:** busca, **Link de nova senha** e **Reenviar confirmação** para ajudar quem não consegue entrar.

## Aluno que não conseguia entrar (agora)

Depois de configurar o SMTP:
1. Peça para o aluno usar **Esqueci minha senha** na tela de login, ou use **Painel → Usuários → Link de nova senha**.
2. Se a conta nunca foi confirmada, use **Reenviar confirmação** (ou, no Supabase, *Authentication → Users → ⋯ → Send
   password recovery*).

## Como testar

1. Crie uma conta de teste com um e-mail seu (que **não** seja da equipe do Supabase) e confirme que o e-mail de confirmação chega.
2. Entre, saia e use **Esqueci minha senha** com esse e-mail: o link deve chegar em poucos minutos e abrir a tela de nova senha.
3. Abra o mesmo link uma segunda vez: deve aparecer "link vencido ou já usado", com botão para pedir outro.
4. Em **Meus dados → Segurança**, troque a senha e entre de novo com a nova.

## Problemas comuns

- *"Não conseguimos enviar o e-mail agora"*: o SMTP não está configurado (ou a senha do SMTP está errada).
- *O e-mail chega, mas o link abre a página inicial ou dá erro*: falta o endereço em **Redirect URLs** (passo 2).
- *"Enviamos e-mails demais em pouco tempo"*: limite de e-mails por hora do Supabase; ajuste em Rate Limits.
- *Cai no spam*: falta autenticar o domínio do remetente (SPF/DKIM) no provedor de e-mail.
