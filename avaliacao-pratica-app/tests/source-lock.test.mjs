import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { evaluations } from '../evaluation-data.mjs';

const EXPECTED = Object.freeze({
  clinico: '25587ae4a7ab9c21337d933e6ed23407db03647fdcdf3c226c47852b97263c19',
  trauma: '016a671fb28710d041ae6e10f59836e8ed96df0b9f26ecddb537cd17746aca3b',
});

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function sourceHash(evaluation) {
  const canonical = evaluation.sourceRule + '\n' + evaluation.items.map((item) => normalize(item.text)).join('\n');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

test('texto oficial clínico permanece bloqueado contra alteração acidental', () => {
  assert.equal(sourceHash(evaluations.clinico), EXPECTED.clinico);
});

test('texto oficial trauma permanece bloqueado contra alteração acidental', () => {
  assert.equal(sourceHash(evaluations.trauma), EXPECTED.trauma);
});
