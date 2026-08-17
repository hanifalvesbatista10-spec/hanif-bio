export function scoreItem(item, status) {
  if (status === 'not_done') return 0;
  if (status === 'partial') return 0.25;
  if (status === 'done') return item.fullScore;
  return null;
}

export function calculateTotal(items, answers) {
  return items.reduce((sum, item) => {
    const score = scoreItem(item, answers[item.n]);
    return sum + (score ?? 0);
  }, 0);
}

export function maxTotal(items) {
  return items.reduce((sum, item) => sum + item.fullScore, 0);
}

export function isComplete(items, answers) {
  return items.every((item) => ['not_done', 'partial', 'done'].includes(answers[item.n]));
}

export function formatScore(value) {
  return value.toFixed(2).replace('.', ',');
}
