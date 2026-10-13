// Comparação de pré-teste e pós-teste. O mesmo aluno é reconhecido pelo e-mail (sem diferenciar maiúsculas nem espaços).
// A nota de cada teste vira percentual (nota ÷ nota máxima). Envio que ainda espera correção manual fica de fora da conta.
const keyOf = (email) => String(email || "").trim().toLowerCase();

export function percentOf(submission) {
  const max = Number(submission?.max_score);
  const score = Number(submission?.score);
  if (!submission || submission.pending_manual || !Number.isFinite(max) || max <= 0 || !Number.isFinite(score)) return null;
  return Math.round((score / max) * 1000) / 10; // uma casa decimal
}

// Entre vários envios do mesmo e-mail, vale o mais recente.
function latestByEmail(submissions) {
  const map = new Map();
  for (const submission of submissions || []) {
    if (submission.status === "in_progress") continue;
    const key = keyOf(submission.respondent_email);
    if (!key) continue;
    const current = map.get(key);
    if (!current || new Date(submission.submitted_at || 0) >= new Date(current.submitted_at || 0)) map.set(key, submission);
  }
  return map;
}

const average = (values) => (values.length ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10 : null);

export function comparePrePost(preSubmissions, postSubmissions) {
  const pre = latestByEmail(preSubmissions);
  const post = latestByEmail(postSubmissions);
  const emails = [...new Set([...pre.keys(), ...post.keys()])];

  const rows = emails
    .map((email) => {
      const a = pre.get(email);
      const b = post.get(email);
      const prePercent = percentOf(a);
      const postPercent = percentOf(b);
      const complete = prePercent !== null && postPercent !== null;
      return {
        email,
        name: b?.respondent_name || a?.respondent_name || "",
        pre: prePercent,
        post: postPercent,
        gain: complete ? Math.round((postPercent - prePercent) * 10) / 10 : null,
        status: a && b ? (complete ? "both" : "pending") : a ? "only_pre" : "only_post",
      };
    })
    .sort((x, y) => (x.name || x.email).localeCompare(y.name || y.email, "pt-BR"));

  const both = rows.filter((row) => row.status === "both");
  return {
    rows,
    summary: {
      preCount: rows.filter((row) => row.pre !== null).length,
      postCount: rows.filter((row) => row.post !== null).length,
      bothCount: both.length,
      preAverage: average(both.map((row) => row.pre)),
      postAverage: average(both.map((row) => row.post)),
      gainAverage: average(both.map((row) => row.gain)),
      improved: both.filter((row) => row.gain > 0).length,
      same: both.filter((row) => row.gain === 0).length,
      worse: both.filter((row) => row.gain < 0).length,
    },
  };
}
