# Afiliados

Rode `supabase/34_afiliados.sql` e depois `supabase/36_comissao_progressiva.sql` uma vez cada. Quem promove
os seus produtos ganha comissão pelas vendas que gerar. O rastreamento reaproveita o sistema de cupons que
já existe: cada afiliado aprovado ganha um **cupom exclusivo**, com desconto para quem compra. Quando um
pedido pago usa esse cupom, a comissão é calculada sozinha e guardada num registro à parte. **O pagamento
da comissão é feito por você, por fora** (Pix, por exemplo); o site só calcula e mostra quanto cada um tem
a receber.

## Como alguém vira afiliado

1. A pessoa preenche o formulário público em **`/seja-afiliado`** (nome, e-mail, WhatsApp opcional, chave
   Pix opcional, e onde pretende divulgar). O pedido cai como **Pendente**; ninguém entra sozinho.
2. Em **Afiliados** (menu do painel), você vê os pedidos pendentes e clica em **Aprovar**.
3. Na aprovação, você define:
   - o **código do cupom** (sugerido a partir do nome, pode trocar);
   - o **desconto** que esse cupom dá (porcentagem ou valor fixo);
   - opcionalmente, uma **comissão só para essa pessoa** (em branco = usa a comissão padrão).
4. Ao confirmar, o site cria o cupom e marca o afiliado como **Ativo**. A partir daí, o link dele é
   `/checkout/<produto>?cupom=<CÓDIGO>` para qualquer um dos seus produtos com checkout do próprio site
   (é o mesmo formato de link com cupom que você já usa em Cupons).

## O painel de Afiliados

- **Configuração:** comissão padrão (%), as faixas progressivas (2ª e 3ª, com meta de vendas e % cada —
  deixe a meta em branco para desativar), o valor mínimo de pagamento (só um aviso, não bloqueia), o link
  dos materiais de divulgação, e o interruptor "Aceitar novos pedidos de afiliados" (desliga o formulário
  público sem apagar nada).
- **Pedidos pendentes:** aprovar ou recusar.
- **Afiliados:** código, comissão (editável por pessoa — se preenchida, sempre vale no lugar da faixa
  progressiva; clique fora do campo para salvar; mostra também a taxa atual calculada pela faixa e quantas
  vendas no mês, quando não tem comissão própria), quanto está **a pagar**, quanto já foi **pago**, status.
  No menu **⋯**: copiar o código, copiar mensagem pronta para WhatsApp, marcar a comissão pendente como
  paga (depois de você fazer o Pix — avisa se o valor está abaixo do mínimo configurado, mas deixa pagar
  assim mesmo), bloquear ou reativar.
- **Bloquear** um afiliado desativa o cupom dele na prática (ele para de contar novas comissões), sem
  apagar o histórico do que já vendeu.

## Comissão progressiva

Sem comissão própria definida, a taxa do afiliado sobe sozinha conforme as vendas pagas **dele, no mês
corrente** (reinicia a contagem todo dia 1): padrão 10%, sobe para a 2ª faixa (padrão 15%, a partir da 5ª
venda do mês) e para a 3ª faixa (padrão 20%, a partir da 10ª venda do mês). É **não retroativo**: só a
venda que bate a meta em diante usa a taxa nova — as comissões já registradas antes continuam com a taxa
que tinham. Os números (quantas vendas para cada faixa, e qual %) são configuráveis em Configuração.

## Painel do afiliado (sem login)

Em **`/painel-afiliado`**, o próprio afiliado consulta os números dele digitando **e-mail + código do
cupom** — sem senha, sem conta. Mostra: comissão atual, vendas pagas no mês, quanto falta para a próxima
faixa (quando aplicável), quanto está a pagar, quanto já foi pago, e um link para baixar os materiais
oficiais de divulgação (quando configurado). Por trás, é uma função do banco (`affiliate_portal`) que só
devolve os dados de quem bate e-mail + código — nunca expõe a tabela de afiliados para visitantes.

## Como a comissão é calculada

Quando um pedido com o cupom de um afiliado é confirmado como **pago** (pelo aviso da InfinitePay/Asaas, o
mesmo lugar que libera o curso), o servidor:

1. Confere se o afiliado está **ativo** (pendente, recusado ou bloqueado não geram comissão).
2. Confere se quem comprou **não é o próprio afiliado** (mesmo e-mail): autocompra nunca gera comissão.
3. Usa a comissão própria da pessoa, se tiver uma definida; senão, calcula a faixa progressiva do mês.
4. Calcula a comissão sobre o **valor realmente pago** (depois do desconto do cupom).
5. Guarda um registro por pedido — o mesmo pedido nunca gera duas comissões, mesmo que o aviso de
   pagamento repita.

Se o pedido for **estornado** depois (Pedidos → Marcar como reembolsado, ou o aviso de reembolso do
Asaas), a comissão ainda não paga é **anulada** automaticamente. Uma comissão já marcada como paga não
é mexida: se isso acontecer, resolva com o afiliado por fora.

## Fraude

É proibida autoindicação (o afiliado comprar com o próprio cupom — já bloqueado automaticamente pelo
sistema), criação de vendas falsas ou uso indevido do código. Em caso de suspeita, bloqueie o afiliado
pelo painel — isso desativa o cupom dele na prática.

## O que este sistema NÃO faz (por enquanto)

- **Não paga a comissão sozinho.** Pagar de verdade (Pix automático) exigiria "split de pagamento" no
  gateway, com o afiliado tendo conta própria lá, cadastro e aprovação — é um projeto bem maior, à parte.
  Hoje, você paga manualmente e marca como pago no painel.
- **Um cupom por afiliado.** Se quiser cupons diferentes para o mesmo afiliado (ex.: um por campanha),
  hoje isso é manual (crie outro cupom em Cupons e ligue a ele por fora, editando o banco). A variação de
  percentual por produto/campanha é coberta pela faixa progressiva (temporária, por mês) e pela comissão
  própria por afiliado — não existe um percentual por produto.

## Migração do banco

`supabase/34_afiliados.sql` cria: `affiliates` (candidaturas e afiliados), `affiliate_settings`
(comissão padrão e se aceita novos pedidos), `affiliate_commissions` (uma linha por pedido pago com cupom
de afiliado) e a coluna `coupons.affiliate_id` (liga um cupom a um afiliado). `supabase/36_comissao_progressiva.sql`
acrescenta as faixas progressivas, o valor mínimo de pagamento, o link de materiais, e a função
`affiliate_portal` (painel sem login). Todas as tabelas têm RLS: o público só consegue **criar** uma
candidatura pendente (nunca já aprovada, nunca com comissão própria); ler e mudar qualquer coisa é só
para o admin, exceto a consulta pontual do próprio painel via `affiliate_portal`, que devolve só os dados
de quem bate e-mail + código.
