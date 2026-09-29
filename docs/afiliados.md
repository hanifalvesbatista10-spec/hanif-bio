# Afiliados

Rode `supabase/34_afiliados.sql` uma vez. Quem promove os seus produtos ganha comissão pelas vendas que
gerar. O rastreamento reaproveita o sistema de cupons que já existe: cada afiliado aprovado ganha um
**cupom exclusivo**, com desconto para quem compra. Quando um pedido pago usa esse cupom, a comissão é
calculada sozinha e guardada num registro à parte. **O pagamento da comissão é feito por você, por fora**
(Pix, por exemplo); o site só calcula e mostra quanto cada um tem a receber.

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

- **Configuração:** comissão padrão (%) e o interruptor "Aceitar novos pedidos de afiliados" (desliga o
  formulário público sem apagar nada).
- **Pedidos pendentes:** aprovar ou recusar.
- **Afiliados:** código, comissão (editável por pessoa, clique fora do campo para salvar), quanto está **a
  pagar**, quanto já foi **pago**, status. No menu **⋯**: copiar o código, copiar mensagem pronta para
  WhatsApp, marcar a comissão pendente como paga (depois de você fazer o Pix), bloquear ou reativar.
- **Bloquear** um afiliado desativa o cupom dele na prática (ele para de contar novas comissões), sem
  apagar o histórico do que já vendeu.

## Como a comissão é calculada

Quando um pedido com o cupom de um afiliado é confirmado como **pago** (pelo aviso da InfinitePay/Asaas, o
mesmo lugar que libera o curso), o servidor:

1. Confere se o afiliado está **ativo** (pendente, recusado ou bloqueado não geram comissão).
2. Confere se quem comprou **não é o próprio afiliado** (mesmo e-mail): autocompra nunca gera comissão.
3. Usa a comissão da pessoa, ou a comissão padrão se ela não tiver uma própria.
4. Calcula a comissão sobre o **valor realmente pago** (depois do desconto do cupom).
5. Guarda um registro por pedido — o mesmo pedido nunca gera duas comissões, mesmo que o aviso de
   pagamento repita.

Se o pedido for **estornado** depois (Pedidos → Marcar como reembolsado, ou o aviso de reembolso do
Asaas), a comissão ainda não paga é **anulada** automaticamente. Uma comissão já marcada como paga não
é mexida: se isso acontecer, resolva com o afiliado por fora.

## O que este sistema NÃO faz (por enquanto)

- **Não paga a comissão sozinho.** Pagar de verdade (Pix automático) exigiria "split de pagamento" no
  gateway, com o afiliado tendo conta própria lá, cadastro e aprovação — é um projeto bem maior, à parte.
  Hoje, você paga manualmente e marca como pago no painel.
- **O afiliado não tem login/portal próprio.** Ele não entra no site para ver os números dele sozinho;
  você acompanha pelo painel e avisa por fora (WhatsApp, por exemplo). Um portal do afiliado é uma
  evolução possível, mas pede login e regras de acesso novas.
- **Um cupom por afiliado.** Se quiser cupons diferentes para o mesmo afiliado (ex.: um por campanha),
  hoje isso é manual (crie outro cupom em Cupons e ligue a ele por fora, editando o banco).

## Migração do banco

`supabase/34_afiliados.sql` cria: `affiliates` (candidaturas e afiliados), `affiliate_settings`
(comissão padrão e se aceita novos pedidos), `affiliate_commissions` (uma linha por pedido pago com cupom
de afiliado) e a coluna `coupons.affiliate_id` (liga um cupom a um afiliado). Todas as tabelas têm RLS:
o público só consegue **criar** uma candidatura pendente (nunca já aprovada, nunca com comissão própria);
ler e mudar qualquer coisa é só para o admin.
