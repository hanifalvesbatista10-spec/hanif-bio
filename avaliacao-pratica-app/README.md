# Avaliação Prática — Clínico e Trauma

Aplicativo web mobile-first para aplicação das duas fichas fornecidas pelo avaliador:

- **AVALIAÇÃO PRÁTICA CLÍNICO** — 20 itens.
- **AVALIAÇÃO DE PRATICA . TRAUMA** — 21 itens.

## Regra de fidelidade

Este projeto não reescreve, corrige ou moderniza a lógica das fichas. Os textos, situações de avaliação e pontuações foram transcritos da documentação fornecida. O sistema apenas transforma a marcação manual em seleção digital e soma a pontuação.

Não há normalização automática para escala 0–10, não há aprovação/reprovação e não há criação de cenários ou critérios extras.

### Clínico

Regra documental: **NÃO REALIZADA = 0,0; REALIZADA PARCIALMENTE = 0,25; REALIZADA = 0,5.**

São 20 itens, portanto o máximo literal é **10,0 pontos**.

### Trauma

Regra documental: **NÃO REALIZADA = 0,0; REALIZADA PARCIALMENTE = 0,25; REALIZADA = 0,5.**

A própria ficha apresenta os itens **8** e **13** com peso explícito **(0,75)**. O item **17** não apresenta peso individual impresso. Para não inventar um novo valor, o item 17 segue a regra geral da ficha para "REALIZADA" (0,5) e "REALIZADA PARCIALMENTE" (0,25). Mantidos literalmente os pesos 0,75 dos itens 8 e 13, o máximo da ficha digital é **11,0 pontos**.

Se a ficha física oficial tiver outra interpretação para esses três casos, a fonte deve ser corrigida/confirmada antes de qualquer alteração no aplicativo.

## Fluxo

1. Informar aluno, avaliador e data.
2. Selecionar **CLÍNICO** ou **TRAUMA**.
3. Para cada item oficial, selecionar exatamente uma situação:
   - NÃO REALIZADA
   - REALIZADA PARCIALMENTE
   - REALIZADA
4. O botão de conclusão só é liberado após todos os itens serem marcados.
5. O sistema exibe a nota nominal do aluno e o detalhamento dos critérios.

## Testes

```bash
npm test
```

Os testes verificam quantidade de itens, regras 0/0,25/0,5, pesos 0,75 do Trauma e ausência de normalização automática.
