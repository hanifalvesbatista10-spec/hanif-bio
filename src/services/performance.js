// Desempenho do aluno: junta as respostas de todas as provas, simulados e tarefas e mostra ONDE ele erra
// (tema e subtema). Funções puras: recebem os dados já lidos do banco e devolvem os números.

export const WEAK_BELOW = 60; // abaixo disso: reforçar
export const STRONG_FROM = 80; // a partir disso: forte
export const MIN_ANSWERS = 3; // menos respostas que isso: "poucos dados"
export const INACTIVE_DAYS = 14;

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const NOT_GRADABLE = ["heading", "text", "image", "scale"];

export function levelOf(percent, answered) {
  if (answered < MIN_ANSWERS || percent === null) return "few";
  if (percent < WEAK_BELOW) return "weak";
  if (percent < STRONG_FROM) return "mid";
  return "strong";
}

const LEVEL_ORDER = { weak: 0, mid: 1, strong: 2, few: 3 };

export const LEVEL_LABEL = {
  weak: "Reforçar",
  mid: "Atenção",
  strong: "Forte",
  few: "Poucos dados",
};

export function formatAnswer(answer) {
  if (answer === null || answer === undefined || answer === "") return "";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object") return answer.name || "";
  return String(answer);
}

export function formatKey(correct) {
  if (correct === null || correct === undefined) return "";
  return Array.isArray(correct) ? correct.join(" / ") : String(correct);
}

// escolhe a grafia mais usada de um texto (RCP, rcp e Rcp viram um tema só)
function pickLabel(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function bucket(map, rawLabel, fallback) {
  const label = String(rawLabel || "").trim() || fallback;
  const key = norm(label);
  if (!map.has(key)) map.set(key, { key, spellings: new Map(), earned: 0, possible: 0, answered: 0, wrong: 0 });
  const item = map.get(key);
  item.spellings.set(label, (item.spellings.get(label) || 0) + 1);
  return item;
}

const finish = (item) => {
  const percent = item.possible > 0 ? Math.round((item.earned / item.possible) * 100) : null;
  return { key: item.key, label: pickLabel(item.spellings), earned: item.earned, possible: item.possible, answered: item.answered, wrong: item.wrong, percent, level: levelOf(percent, item.answered) };
};

const byLevel = (a, b) => (LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]) || ((a.percent ?? 101) - (b.percent ?? 101)) || b.answered - a.answered;

// submissions: { id, form_id, submitted_at, score, max_score, passed, pending_manual, form: { title, type } }
// answers: { submission_id, block_id, answer, is_correct, points_awarded, needs_review }
// blocks: { id, type, title, points, topic, subtopic, options }   keys: { block_id, correct, annulled, feedback }
export function computeStudentPerformance({ submissions = [], answers = [], blocks = [], keys = [], now = new Date() }) {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const keyById = new Map(keys.map((key) => [key.block_id, key]));
  const subById = new Map(submissions.map((sub) => [sub.id, sub]));

  const topics = new Map();
  const missed = new Map();

  answers.forEach((answer) => {
    const block = blockById.get(answer.block_id);
    const sub = subById.get(answer.submission_id);
    if (!block || !sub) return;
    const key = keyById.get(block.id);
    const points = Number(block.points) || 0;
    if (NOT_GRADABLE.includes(block.type) || points <= 0 || answer.needs_review || key?.annulled) return;

    const earned = Math.min(Number(answer.points_awarded) || 0, points);
    const topic = bucket(topics, block.topic, "Sem tema");
    if (!topic.subs) topic.subs = new Map();
    const sub2 = bucket(topic.subs, block.subtopic, "Sem subtema");
    [topic, sub2].forEach((item) => {
      item.earned += earned;
      item.possible += points;
      item.answered += 1;
      if (earned < points) item.wrong += 1;
    });

    if (earned < points) {
      if (!missed.has(block.id)) missed.set(block.id, { block, key, times: 0, misses: 0, last: null });
      const entry = missed.get(block.id);
      entry.misses += 1;
      if (!entry.last || new Date(sub.submitted_at) > new Date(entry.last.at)) {
        entry.last = { at: sub.submitted_at, answer: answer.answer, earned, formTitle: sub.form?.title || "" };
      }
    }
  });

  // quantas vezes cada questão errada foi respondida
  answers.forEach((answer) => {
    if (missed.has(answer.block_id) && !answer.needs_review) missed.get(answer.block_id).times += 1;
  });

  const topicList = [...topics.values()]
    .map((topic) => ({ ...finish(topic), subtopics: [...(topic.subs?.values() || [])].map(finish).sort(byLevel) }))
    .sort(byLevel);

  const missedList = [...missed.values()]
    .map((entry) => ({
      blockId: entry.block.id,
      title: entry.block.title,
      type: entry.block.type,
      topic: String(entry.block.topic || "").trim() || "Sem tema",
      subtopic: String(entry.block.subtopic || "").trim(),
      misses: entry.misses,
      times: entry.times,
      points: Number(entry.block.points) || 0,
      earned: entry.last.earned,
      lastAnswer: formatAnswer(entry.last.answer),
      correct: formatKey(entry.key?.correct),
      feedback: entry.key?.feedback || "",
      formTitle: entry.last.formTitle,
      at: entry.last.at,
    }))
    .sort((a, b) => b.misses - a.misses || new Date(b.at) - new Date(a.at));

  const attempts = submissions
    .map((sub) => ({
      id: sub.id,
      formId: sub.form_id,
      title: sub.form?.title || "Sem título",
      type: sub.form?.type || "",
      at: sub.submitted_at,
      score: sub.score,
      max: sub.max_score,
      percent: Number(sub.max_score) > 0 ? Math.round((Number(sub.score || 0) / Number(sub.max_score)) * 100) : null,
      pending: Boolean(sub.pending_manual),
      passed: sub.passed,
      attemptNumber: sub.attempt_number,
    }))
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  const scored = attempts.filter((item) => item.percent !== null && !item.pending);
  const avg = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.percent, 0) / scored.length) : null;

  let trend = null;
  if (scored.length >= 4) {
    const half = Math.floor(scored.length / 2);
    const mean = (list) => list.reduce((sum, item) => sum + item.percent, 0) / list.length;
    trend = Math.round(mean(scored.slice(-half)) - mean(scored.slice(0, half)));
  }

  const last = attempts.length ? attempts[attempts.length - 1].at : null;
  const daysSince = last ? Math.floor((new Date(now) - new Date(last)) / 86400000) : null;

  return {
    overall: {
      attempts: attempts.length,
      avg,
      passed: attempts.filter((item) => item.passed === true).length,
      failed: attempts.filter((item) => item.passed === false).length,
      pending: attempts.filter((item) => item.pending).length,
      last,
      daysSince,
      trend,
    },
    attempts,
    topics: topicList,
    missed: missedList,
  };
}

// Sinais de atenção para o instrutor
export function riskSignals(perf, { hasPendingForms = false } = {}) {
  const signals = [];
  if (perf.overall.avg !== null && perf.overall.avg < WEAK_BELOW && perf.overall.attempts >= 2) signals.push(`Média de ${perf.overall.avg}%, abaixo de ${WEAK_BELOW}%`);
  if (perf.overall.daysSince !== null && perf.overall.daysSince > INACTIVE_DAYS && hasPendingForms) signals.push(`Sem fazer atividade há ${perf.overall.daysSince} dias`);
  if (perf.overall.trend !== null && perf.overall.trend <= -10) signals.push(`Desempenho caindo (${perf.overall.trend} pontos)`);
  return signals;
}

// Resumo em texto para copiar e usar numa conversa com o aluno
export function summaryText(name, perf) {
  const first = String(name || "").trim().split(/\s+/)[0] || "aluno";
  const lines = [`Resumo de desempenho de ${first}`];
  if (perf.overall.avg !== null) lines.push(`Média geral: ${perf.overall.avg}% em ${perf.overall.attempts} ${perf.overall.attempts === 1 ? "envio" : "envios"}.`);
  const weak = perf.topics.filter((topic) => topic.level === "weak" || topic.level === "mid").slice(0, 4);
  if (weak.length) {
    lines.push("Pontos para reforçar:");
    weak.forEach((topic) => {
      const parts = topic.subtopics.filter((sub) => (sub.level === "weak" || sub.level === "mid") && sub.key !== "sem subtema").slice(0, 3);
      lines.push(`- ${topic.label} (${topic.percent}%)${parts.length ? `: ${parts.map((sub) => `${sub.label} ${sub.percent}%`).join(", ")}` : ""}`);
    });
  }
  const strong = perf.topics.filter((topic) => topic.level === "strong").slice(0, 3);
  if (strong.length) lines.push(`Pontos fortes: ${strong.map((topic) => `${topic.label} (${topic.percent}%)`).join(", ")}.`);
  return lines.join("\n");
}
