// Provas, simulados e atividades: constantes e funções compartilhadas (aluno e painel).
import { supabase } from "./supabase";

export const FORM_TYPES = [
  ["exam", "Prova"],
  ["mock", "Simulado"],
  ["activity", "Atividade"],
  ["task", "Tarefa"],
  ["survey", "Pesquisa"],
  ["information", "Coleta de informações"],
];

export const typeLabel = (type) => FORM_TYPES.find(([value]) => value === type)?.[1] || type;

export const BLOCK_TYPES = [
  { value: "choice", label: "Múltipla escolha (uma correta)", group: "Objetivas" },
  { value: "multi_choice", label: "Várias corretas", group: "Objetivas" },
  { value: "true_false", label: "Verdadeiro ou falso", group: "Objetivas" },
  { value: "yes_no", label: "Sim ou não", group: "Objetivas" },
  { value: "short_text", label: "Resposta curta", group: "Objetivas" },
  { value: "number", label: "Resposta numérica", group: "Objetivas" },
  { value: "long_text", label: "Discursiva (correção manual)", group: "Você corrige" },
  { value: "file", label: "Envio de arquivo (correção manual)", group: "Você corrige" },
  { value: "scale", label: "Escala de 0 a 10", group: "Pesquisa" },
  { value: "heading", label: "Título de seção", group: "Conteúdo" },
  { value: "text", label: "Texto explicativo", group: "Conteúdo" },
  { value: "image", label: "Imagem", group: "Conteúdo" },
];

export const blockLabel = (type) => BLOCK_TYPES.find((item) => item.value === type)?.label || type;
export const CONTENT_TYPES = ["heading", "text", "image"];
export const isQuestion = (type) => !CONTENT_TYPES.includes(type);
export const isManualType = (type) => type === "long_text" || type === "file";
export const hasOptions = (type) => type === "choice" || type === "multi_choice";
export const canHavePoints = (type) => isQuestion(type) && type !== "scale";

export const RELEASE_MODES = [
  ["immediate", "Na hora do envio (se não houver questão para corrigir)"],
  ["manual", "Só quando eu liberar"],
  ["date", "Em uma data marcada"],
];

export const slugify = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatScore(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

export function percent(score, max) {
  const total = Number(max);
  if (!total) return null;
  return Math.round((Number(score || 0) / total) * 100);
}

export function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Embaralhar de forma repetível: a mesma tentativa sempre mostra a mesma ordem, mesmo recarregando a página.
function seedFrom(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function seededShuffle(list, seedText) {
  const random = seedFrom(String(seedText));
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Situação de um envio para o painel
export function submissionState(submission, form) {
  if (submission.pending_manual) return { key: "pending", label: "Aguardando correção", tone: "review" };
  const releasedByDate = form?.release_mode === "date" && form?.release_at && new Date(form.release_at) <= new Date();
  if (submission.results_released_at || releasedByDate) return { key: "released", label: "Liberado ao aluno", tone: "published" };
  return { key: "graded", label: "Corrigido, não liberado", tone: "draft" };
}

export async function uploadFormImage(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem (JPG, PNG ou WebP).");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `forms/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("forms-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("forms-media").getPublicUrl(path).data.publicUrl;
}

const ALLOWED_UPLOADS = /\.(pdf|png|jpe?g|webp|docx?|txt)$/i;

// Envio de arquivo do aluno (tarefas). Fica em um bucket privado, dentro da pasta do próprio aluno.
export async function uploadAnswerFile(formId, userId, file) {
  if (!ALLOWED_UPLOADS.test(file.name)) throw new Error("Envie um PDF, imagem, documento do Word ou texto.");
  if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 10 MB.");
  const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `forms/${formId}/${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("form-uploads").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw error;
  return { path, name: file.name, size: file.size };
}

export async function signedFileUrl(path) {
  const { data, error } = await supabase.storage.from("form-uploads").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

// Mensagens do banco em português simples
export function friendlyFormError(error) {
  const text = String(error?.message || error || "");
  if (/does not exist|42883|42P01|PGRST202|PGRST205|form_start_attempt|form_list_for_student/i.test(text)) {
    return "Este recurso ainda não foi ativado no sistema. Avise a equipe.";
  }
  return text || "Algo deu errado. Tente de novo.";
}

// Texto para copiar e colar em qualquer IA para gerar as perguntas no formato de importação
export const AI_PROMPT = `Crie perguntas de prova para importar no meu site. Use EXATAMENTE este formato, separando cada pergunta com uma linha contendo apenas ---

TIPO: múltipla escolha
PERGUNTA: (enunciado)
A) (alternativa)
B) (alternativa)
C) (alternativa)
D) (alternativa)
CORRETA: B
COMENTÁRIO: (explicação da resposta certa, que o aluno lê depois da correção)
PONTOS: 1
TEMA: (assunto, ex.: RCP)
---

Tipos aceitos em TIPO: múltipla escolha, várias corretas (em CORRETA use as letras separadas por vírgula, ex.: A, C), verdadeiro ou falso (CORRETA: Verdadeiro ou Falso), sim ou não, resposta curta (em CORRETA, as respostas aceitas separadas por ponto e vírgula), numérica (CORRETA: 75 e TOLERÂNCIA: 5), discursiva (sem CORRETA; o comentário vira a resposta esperada), escala.

Quantidade: [NÚMERO] perguntas sobre [ASSUNTO]. Nível: [BÁSICO/INTERMEDIÁRIO/AVANÇADO]. Não escreva nada além das perguntas.`;
