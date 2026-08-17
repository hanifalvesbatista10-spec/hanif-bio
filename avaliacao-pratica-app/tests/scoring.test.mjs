import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluations } from '../evaluation-data.mjs';
import { scoreItem, calculateTotal, maxTotal, isComplete } from '../scoring.mjs';

test('regra clínica: 0 / 0,25 / 0,5', () => {
  const item = evaluations.clinico.items[0];
  assert.equal(scoreItem(item, 'not_done'), 0);
  assert.equal(scoreItem(item, 'partial'), 0.25);
  assert.equal(scoreItem(item, 'done'), 0.5);
});

test('clínico preserva 20 itens e máximo 10,0', () => {
  assert.equal(evaluations.clinico.items.length, 20);
  assert.equal(maxTotal(evaluations.clinico.items), 10);
});

test('trauma preserva 21 itens e pesos 0,75 dos itens 8 e 13', () => {
  assert.equal(evaluations.trauma.items.length, 21);
  assert.equal(evaluations.trauma.items.find((i) => i.n === 8).fullScore, 0.75);
  assert.equal(evaluations.trauma.items.find((i) => i.n === 13).fullScore, 0.75);
  assert.equal(maxTotal(evaluations.trauma.items), 11);
});

test('parcial permanece 0,25 também nos itens trauma com máximo 0,75, conforme regra geral da ficha', () => {
  const item8 = evaluations.trauma.items.find((i) => i.n === 8);
  assert.equal(scoreItem(item8, 'partial'), 0.25);
  assert.equal(scoreItem(item8, 'done'), 0.75);
});

test('nota final é soma literal; não existe normalização automática', () => {
  const answers = Object.fromEntries(evaluations.clinico.items.map((item) => [item.n, 'done']));
  assert.equal(calculateTotal(evaluations.clinico.items, answers), 10);
  assert.equal(isComplete(evaluations.clinico.items, answers), true);
});
