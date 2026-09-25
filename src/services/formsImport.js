// Importação em lote de perguntas (texto no formato do modelo ou JSON gerado por IA) para o construtor.
import { hasOptions, isQuestion } from "./forms";

const TYPE_ALIASES = {
  "multipla escolha": "choice", "múltipla escolha": "choice", multipla: "choice", escolha: "choice", choice: "choice",
  "varias corretas": "multi_choice", "várias corretas": "multi_choice", "caixas de selecao": "multi_choice", "caixas de seleção": "multi_choice",
  multipla_selecao: "multi_choice", multi_choice: "multi_choice",
  "verdadeiro ou falso": "true_false", "verdadeiro/falso": "true_false", verdadeiro_falso: "true_false", true_false: "true_false",
  "sim ou nao": "yes_no", "sim ou não": "yes_no", sim_nao: "yes_no", yes_no: "yes_no",
  "resposta curta": "short_text", curta: "short_text", short_text: "short_text",
  discursiva: "long_text", "resposta longa": "long_text", longa: "long_text", long_text: "long_text",
  numerica: "number", "numérica": "number", numero: "number", número: "number", number: "number",
  arquivo: "file", "envio de arquivo": "file", file: "file",
  escala: "scale", scale: "scale",
};

export function emptyBlock(type = "choice") {
  return {
    id: crypto.randomUUID(),
    isNew: true,
    type,
    title: "",
    description: "",
    image_url: "",
    required: true,
    points: 1,
    topic: "",
    options: type === "choice" || type === "multi_choice" ? ["", ""] : [],
    correct_idx: -1,
    correct_set: [],
    tf: "",
    accepted_text: "",
    number_value: "",
    tolerance: "",
    partial_credit: false,
    annulled: false,
    feedback: "",
    feedback_image_url: "",
  };
}

const toNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const letterIndex = (token, options) => {
  const match = String(token).trim().match(/^([A-Ha-h])[)\.\-:]?$/);
  if (!match) return -1;
  const idx = match[1].toUpperCase().charCodeAt(0) - 65;
  return idx < options.length ? idx : -1;
};

// Aplica a resposta correta (texto, letra ou lista) ao bloco conforme o tipo
function applyCorrect(block, raw) {
  const value = String(raw || "").trim();
  if (!value) return block;
  if (block.type === "choice") {
    const byLetter = letterIndex(value, block.options);
    const byText = block.options.findIndex((option) => option.trim().toLowerCase() === value.toLowerCase());
    block.correct_idx = byLetter >= 0 ? byLetter : byText;
  } else if (block.type === "multi_choice") {
    const parts = value.split(/[;,|]/).map((part) => part.trim()).filter(Boolean);
    block.correct_set = parts
      .map((part) => {
        const byLetter = letterIndex(part, block.options);
        return byLetter >= 0 ? byLetter : block.options.findIndex((option) => option.trim().toLowerCase() === part.toLowerCase());
      })
      .filter((idx) => idx >= 0);
  } else if (block.type === "true_false") {
    block.tf = /^v|^verdadeiro|^true|^certo/i.test(value) ? "Verdadeiro" : "Falso";
  } else if (block.type === "yes_no") {
    block.tf = /^s|^sim|^yes/i.test(value) ? "Sim" : "Não";
  } else if (block.type === "short_text") {
    block.accepted_text = value.split(/;|\|/).map((part) => part.trim()).filter(Boolean).join("\n");
  } else if (block.type === "number") {
    block.number_value = value.replace(",", ".");
  }
  return block;
}

function fromJsonItem(item) {
  const type = TYPE_ALIASES[String(item.type || item.tipo || "choice").toLowerCase()] || "choice";
  const options = item.options || item.alternativas || [];
  const block = {
    ...emptyBlock(type),
    title: String(item.question || item.pergunta || item.title || "").trim(),
    description: String(item.description || item.descricao || "").trim(),
    options: hasOptions(type) ? (Array.isArray(options) ? options.map(String) : String(options).split("\n")) : [],
    required: item.required !== false && item.obrigatoria !== false,
    points: toNumber(item.points ?? item.pontos, 1),
    topic: String(item.topic || item.tema || "").trim(),
    feedback: String(item.feedback || item.comentario || item.comentário || "").trim(),
    tolerance: item.tolerance ?? item.tolerancia ?? "",
    partial_credit: Boolean(item.partial_credit ?? item.nota_parcial ?? false),
  };
  const correct = item.correct_answer ?? item.resposta_correta ?? item.correta ?? item.correct;
  applyCorrect(block, Array.isArray(correct) ? correct.join(";") : correct);
  return block;
}

function fromTextChunk(chunk) {
  const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
  const get = (labels) => {
    const line = lines.find((entry) => labels.some((label) => entry.toLowerCase().startsWith(label)));
    return line ? line.slice(line.indexOf(":") + 1).trim() : "";
  };
  const typeRaw = get(["tipo:", "type:"]).toLowerCase();
  const type = TYPE_ALIASES[typeRaw] || "choice";
  const optionLines = lines.filter((entry) => /^[A-Ha-h][)\.\-:]\s+/.test(entry) || /^[-•]\s+/.test(entry));
  const options = optionLines.map((entry) => entry.replace(/^[A-Ha-h][)\.\-:]\s+/, "").replace(/^[-•]\s+/, "").trim());
  const question = get(["pergunta:", "questao:", "questão:", "question:", "enunciado:"]) || lines[0].replace(/^\d+[)\.\-\s]+/, "");
  const requiredRaw = get(["obrigatoria:", "obrigatória:", "required:"]).toLowerCase();
  const block = {
    ...emptyBlock(type),
    title: question.trim(),
    options: hasOptions(type) ? options : [],
    required: requiredRaw ? !["nao", "não", "false", "0"].includes(requiredRaw) : true,
    points: toNumber(get(["pontos:", "pontuacao:", "pontuação:", "points:"]), 1),
    topic: get(["tema:", "assunto:", "topic:"]),
    feedback: get(["comentario:", "comentário:", "explicacao:", "explicação:", "feedback:"]),
    tolerance: get(["tolerancia:", "tolerância:"]),
    partial_credit: /^(sim|s|true|1)/i.test(get(["nota parcial:", "parcial:"])),
  };
  return applyCorrect(block, get(["correta:", "corretas:", "resposta correta:", "gabarito:", "correct:"]));
}

export function parseImport(text) {
  const clean = String(text || "").replace(/\r/g, "").trim();
  if (!clean) throw new Error("Cole as perguntas para importar.");

  let blocks;
  if (clean.startsWith("[") || clean.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("Não consegui ler o JSON. Confira o formato ou use o modelo de texto.");
    }
    const items = Array.isArray(parsed) ? parsed : parsed.questions || parsed.perguntas;
    if (!Array.isArray(items)) throw new Error("O JSON precisa ser uma lista de perguntas.");
    blocks = items.map(fromJsonItem);
  } else {
    const chunks = clean.split(/\n\s*---+\s*\n/g).map((part) => part.trim()).filter(Boolean);
    blocks = chunks.map(fromTextChunk);
  }

  blocks = blocks.filter((block) => block.title);
  if (!blocks.length) throw new Error("Nenhuma pergunta reconhecida. Use o modelo mostrado abaixo.");
  const withoutAnswer = blocks.filter((block) => isQuestion(block.type) && block.points > 0 && needsKey(block) && !hasKey(block)).length;
  return { blocks, withoutAnswer };
}

const needsKey = (block) => !["long_text", "file", "scale"].includes(block.type);

export function hasKey(block) {
  if (block.type === "choice") return block.correct_idx >= 0;
  if (block.type === "multi_choice") return block.correct_set.length > 0;
  if (block.type === "true_false" || block.type === "yes_no") return Boolean(block.tf);
  if (block.type === "short_text") return block.accepted_text.trim().length > 0;
  if (block.type === "number") return String(block.number_value).trim() !== "";
  return true;
}
