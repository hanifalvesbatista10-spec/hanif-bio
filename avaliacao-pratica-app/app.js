import { evaluations } from './evaluation-data.mjs';
import { calculateTotal, maxTotal, isComplete, formatScore, scoreItem } from './scoring.mjs';

const state = {
  type: '',
  student: '',
  evaluator: '',
  date: new Date().toISOString().slice(0, 10),
  answers: {},
  finalized: false,
};

const setupView = document.querySelector('#setupView');
const evaluationView = document.querySelector('#evaluationView');
const resultView = document.querySelector('#resultView');
const form = document.querySelector('#setupForm');
const studentInput = document.querySelector('#student');
const evaluatorInput = document.querySelector('#evaluator');
const dateInput = document.querySelector('#date');
const typeInputs = [...document.querySelectorAll('input[name="evaluationType"]')];

dateInput.value = state.date;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const type = typeInputs.find((input) => input.checked)?.value;
  if (!type) return;

  state.type = type;
  state.student = studentInput.value.trim();
  state.evaluator = evaluatorInput.value.trim();
  state.date = dateInput.value;
  state.answers = {};
  state.finalized = false;
  renderEvaluation();
});

document.querySelector('#backToSetup').addEventListener('click', () => {
  evaluationView.hidden = true;
  setupView.hidden = false;
});

document.querySelector('#newEvaluation').addEventListener('click', () => {
  state.answers = {};
  state.finalized = false;
  resultView.hidden = true;
  setupView.hidden = false;
  evaluationView.hidden = true;
  form.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
});

function renderEvaluation() {
  const evaluation = evaluations[state.type];
  setupView.hidden = true;
  resultView.hidden = true;
  evaluationView.hidden = false;

  document.querySelector('#evaluationTitle').textContent = evaluation.title;
  document.querySelector('#studentBadge').textContent = state.student;
  document.querySelector('#sourceRule').textContent = evaluation.sourceRule;

  const list = document.querySelector('#itemsList');
  list.innerHTML = '';

  evaluation.items.forEach((item) => {
    if (evaluation.sections?.[item.n]) {
      const section = document.createElement('h3');
      section.className = 'section-title';
      section.textContent = evaluation.sections[item.n];
      list.appendChild(section);
    }

    const card = document.createElement('section');
    card.className = 'item-card';
    card.dataset.item = item.n;

    const header = document.createElement('div');
    header.className = 'item-header';
    header.innerHTML = `<span class="item-number">${item.n}</span><div class="item-text"></div>`;
    header.querySelector('.item-text').textContent = item.text;
    card.appendChild(header);

    const options = document.createElement('div');
    options.className = 'status-grid';
    options.innerHTML = `
      ${optionButton(item, 'not_done', 'NÃO REALIZADA')}
      ${optionButton(item, 'partial', 'REALIZADA PARCIALMENTE')}
      ${optionButton(item, 'done', 'REALIZADA')}
    `;
    card.appendChild(options);

    const score = document.createElement('div');
    score.className = 'item-score';
    score.id = `score-${item.n}`;
    score.textContent = 'Pontuação: —';
    card.appendChild(score);

    options.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-status]');
      if (!button) return;
      state.answers[item.n] = button.dataset.status;
      [...options.querySelectorAll('button')].forEach((btn) => btn.classList.remove('selected'));
      button.classList.add('selected');
      score.textContent = `Pontuação: ${formatScore(scoreItem(item, state.answers[item.n]))}`;
      updateProgress();
    });

    list.appendChild(card);
  });

  updateProgress();
}

function optionButton(item, status, label) {
  const full = status === 'done' ? item.fullScore : status === 'partial' ? 0.25 : 0;
  return `<button type="button" data-status="${status}" class="status-button ${status}">
    <span>${label}</span><strong>${formatScore(full)}</strong>
  </button>`;
}

function updateProgress() {
  const evaluation = evaluations[state.type];
  const answered = Object.keys(state.answers).length;
  const totalItems = evaluation.items.length;
  const current = calculateTotal(evaluation.items, state.answers);
  const max = maxTotal(evaluation.items);

  document.querySelector('#progressText').textContent = `${answered}/${totalItems} itens avaliados`;
  document.querySelector('#currentScore').textContent = `${formatScore(current)} / ${formatScore(max)}`;
  document.querySelector('#progressBar').style.width = `${(answered / totalItems) * 100}%`;
  document.querySelector('#finishButton').disabled = !isComplete(evaluation.items, state.answers);
}

document.querySelector('#finishButton').addEventListener('click', () => {
  const evaluation = evaluations[state.type];
  if (!isComplete(evaluation.items, state.answers)) return;

  state.finalized = true;
  const total = calculateTotal(evaluation.items, state.answers);
  const max = maxTotal(evaluation.items);

  evaluationView.hidden = true;
  resultView.hidden = false;

  document.querySelector('#resultStudent').textContent = state.student;
  document.querySelector('#resultType').textContent = evaluation.title;
  document.querySelector('#resultEvaluator').textContent = state.evaluator;
  document.querySelector('#resultDate').textContent = new Date(`${state.date}T12:00:00`).toLocaleDateString('pt-BR');
  document.querySelector('#resultScore').textContent = formatScore(total);
  document.querySelector('#resultMax').textContent = formatScore(max);

  const tableBody = document.querySelector('#resultItems');
  tableBody.innerHTML = evaluation.items.map((item) => {
    const status = state.answers[item.n];
    const label = status === 'done' ? 'REALIZADA' : status === 'partial' ? 'REALIZADA PARCIALMENTE' : 'NÃO REALIZADA';
    return `<tr>
      <td>${item.n}</td>
      <td>${escapeHtml(item.text).replaceAll('\n', '<br>')}</td>
      <td>${label}</td>
      <td>${formatScore(scoreItem(item, status))}</td>
    </tr>`;
  }).join('');
});

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
