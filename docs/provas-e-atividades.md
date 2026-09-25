# Provas, simulados e atividades

Painel: **Provas e atividades** (menu lateral). Aluno: aba **Atividades** na Área do aluno.

## Antes de usar (uma vez)

Rode `supabase/21_provas_e_atividades.sql` no SQL Editor do Supabase (pode rodar mais de uma vez). Ele:
- tira o **gabarito** da tabela pública e o guarda numa tabela privada (antes qualquer visitante conseguia ler as respostas certas);
- cria tentativas, cronômetro, correção manual, liberação de nota e as funções usadas pelo site.
Depois de rodar, faça o deploy do site. Provas e pesquisas que você já tinha continuam funcionando (gabaritos são migrados sozinhos).

## Criar uma prova

1. **Provas e atividades → Criar novo.**
2. **Informações:** título, instruções, tipo (Prova, Simulado, Atividade, Tarefa, Pesquisa) e situação.
3. **Quem responde e como:**
   - *Só alunos logados* (padrão): aparece em Atividades. Opções: só quem tem acesso a um produto, tentativas, tempo de prova,
     nota mínima, abrir/encerrar em data, embaralhar perguntas e alternativas.
   - *Qualquer pessoa com o link* (`/f/endereço`): para pesquisas e coletas. Sem tempo, tentativas ou liberação de nota.
4. **Nota e comentários para o aluno:** escolha quando liberar:
   - *Na hora do envio* (se não houver questão para você corrigir);
   - *Só quando eu liberar* (individual ou todos de uma vez, em Resultados);
   - *Em uma data marcada*.
   Antes da liberação o aluno só vê que a prova foi enviada. Dá para mostrar o gabarito e os comentários só quando ele usar todas as tentativas.
5. **Perguntas:** escolha o tipo e clique em Adicionar (ou importe várias, abaixo).
6. **Publicar.** Rascunho não aparece para ninguém.

## Tipos de pergunta

| Tipo | Como corrige |
| --- | --- |
| Múltipla escolha, Verdadeiro/falso, Sim/não | Automático (marque a correta) |
| Várias corretas | Automático; opção de **nota parcial** (acerto soma, erro desconta) |
| Resposta curta | Automático; liste as variações aceitas (ignora maiúsculas e acentos) |
| Numérica | Automático; com **diferença aceita** (ex.: 75 ± 5) |
| Discursiva e Envio de arquivo | **Você corrige** em Resultados (nota de 0 até os pontos + comentário) |
| Escala 0 a 10 | Não tem nota (pesquisa) |
| Título, Texto, Imagem | Só conteúdo |

Cada pergunta tem: **pontos**, **tema** (para o desempenho por tema), **comentário da questão** (com imagem, aparece depois da liberação),
**obrigatória** e **anular questão** (todos ganham os pontos).

## Importar várias perguntas

Em Perguntas → **Importar várias de uma vez** → **Copiar instruções para a IA**. Cole na IA (ChatGPT, Claude...), troque os trechos entre
colchetes e cole o resultado de volta. Aceita `CORRETA: C` (letra) ou o texto, `A, C` para várias corretas, `COMENTÁRIO:`, `TEMA:`, `PONTOS:`.

## Corrigir e liberar (Resultados)

- Abas **Respostas** e **Por questão** (% de acerto, alternativas mais marcadas, desempenho por tema).
- Filtro **Para corrigir**. **Corrigir** abre a resposta: dê a nota e um comentário por questão; **Próxima para corrigir** pula para a seguinte.
- **Liberar N resultados** libera todos os já corrigidos; no menu da linha dá para liberar ou **ocultar** um por um.
- Cada questão tem **Ajustar nota** (vale para as automáticas também). Há um **comentário geral** para o aluno.
- **Mais ações → Recalcular todas as notas:** use depois de corrigir um gabarito, mudar pontos ou anular uma questão. Notas dadas à mão são mantidas.
- **Exportar planilha (CSV)** com nota, situação e respostas.
- Excluir uma resposta devolve a tentativa ao aluno.

## Regras que valem a pena saber

- O **tempo** começa quando o aluno clica em Começar. Se a página recarregar, o relógio continua e as respostas voltam do rascunho salvo no aparelho.
  Ao chegar a zero, o envio é automático (o servidor aceita até 60 segundos de folga).
- As **perguntas de provas de alunos** só são lidas por quem tem uma tentativa em andamento (e pelo admin). O gabarito nunca vai para o navegador do aluno antes da liberação.
- **Editar uma prova já respondida:** as perguntas mantêm o mesmo código, então as respostas não se perdem. Se você **remover** uma pergunta, as respostas dela são apagadas (o painel avisa).
  Mudou gabarito ou pontos? Use *Recalcular todas as notas*.
- Envios de arquivo ficam em um espaço privado; só o aluno e o admin acessam.
- O aluno com **uma só tentativa** que precisar refazer: exclua a resposta dele em Resultados.
