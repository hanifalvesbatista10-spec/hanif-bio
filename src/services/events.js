// Regras compartilhadas dos eventos (página pública e painel).

export const LEGACY_SLUG = "aulao-aph-barro-2026";

export const EXPERIENCE_OPTIONS = [
  ["iniciante", "Estou começando"],
  ["estudante", "Sou estudante"],
  ["profissional", "Já atuo na área"],
  ["experiente", "Tenho experiência em APH"],
];

export const GOAL_OPTIONS = [
  ["atualizacao", "Atualização profissional"],
  ["samu", "Trabalhar no SAMU"],
  ["provas", "Provas e processos seletivos"],
  ["pratica", "Melhorar minha prática no APH"],
  ["conhecimento", "Ampliar conhecimentos"],
];

export const ASK_FIELDS = [
  ["city", "Cidade"],
  ["occupation", "Profissão / ocupação"],
  ["aph_experience", "Contato com o APH"],
  ["main_goal", "Principal objetivo"],
];

// Onde o link vai ser divulgado — vira ?origem= e aparece nos resultados.
export const ORIGINS = [
  ["", "Sem origem (link direto)"],
  ["bio", "Bio do Instagram"],
  ["stories", "Stories"],
  ["whatsapp", "WhatsApp"],
  ["grupo", "Grupo / comunidade"],
  ["indicacao", "Indicação"],
];

export const STATUS_LABELS = { draft: "Rascunho", published: "Inscrições abertas", closed: "Encerrado" };

export function labelFor(options, value) {
  return options.find(([key]) => key === value)?.[1] || value || "—";
}

export function slugify(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function eventUrl(slug, origin = "") {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/evento/${slug}${origin ? `?origem=${origin}` : ""}`;
}

export function cleanOrigin(value) {
  const cleaned = String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  return cleaned || "link";
}

export const EMPTY_EVENT = {
  title: "",
  slug: "",
  kicker: "EVENTO GRATUITO",
  headline: "",
  subtitle: "",
  tags: [],
  info: [
    { title: "", text: "" },
    { title: "", text: "" },
    { title: "", text: "" },
  ],
  section_title: "",
  description: "",
  topics: [
    { title: "", text: "" },
    { title: "", text: "" },
    { title: "", text: "" },
    { title: "", text: "" },
  ],
  form_title: "Faça sua inscrição gratuita",
  form_intro: "Preencha seus dados para garantir sua inscrição e receber as próximas informações.",
  cta_label: "GARANTIR MINHA INSCRIÇÃO GRATUITA",
  ask_fields: { city: true, occupation: true, aph_experience: true, main_goal: true },
  success_title: "Inscrição confirmada.",
  success_message: "Sua inscrição foi confirmada. Fique de olho no WhatsApp e no e-mail: enviaremos data, local e orientações.",
  whatsapp_group_url: "",
  capacity: null,
  registration_deadline: null,
  status: "draft",
};

// O evento que já existia continua funcionando mesmo antes de a migration 15 ser executada.
export const LEGACY_EVENT = {
  ...EMPTY_EVENT,
  slug: LEGACY_SLUG,
  title: "Aulão APH — Barro-CE",
  kicker: "AULÃO GRATUITO EM",
  headline: "BARRO–CE",
  subtitle: "CURSO INTENSIVO DE *ATENDIMENTO PRÉ-HOSPITALAR*",
  tags: ["CLÍNICO", "TRAUMA", "TEORIA + PRÁTICA", "100% GRATUITO"],
  info: [
    { title: "EM BREVE", text: "Data será divulgada aos inscritos" },
    { title: "BARRO–CE", text: "Local será informado aos inscritos" },
    { title: "VAGAS LIMITADAS", text: "Inscrição gratuita" },
  ],
  section_title: "Atualização para quem quer decidir melhor no APH.",
  description:
    "O aulão foi pensado para profissionais, estudantes e interessados em atendimento pré-hospitalar que desejam revisar conceitos e fortalecer a tomada de decisão diante de situações clínicas e traumáticas.",
  topics: [
    { title: "Atendimento clínico", text: "Reconhecimento, avaliação e prioridades iniciais." },
    { title: "Atendimento ao trauma", text: "Abordagem, prioridades e tomada de decisão." },
    { title: "Conteúdo aplicado", text: "Foco na realidade do atendimento pré-hospitalar." },
    { title: "Barro–CE", text: "Data e local serão divulgados aos inscritos." },
  ],
  success_message:
    "Você está inscrito no Aulão Intensivo de Atendimento Pré-Hospitalar — Clínico + Trauma, em Barro–CE. Entre agora no grupo oficial para receber data, local e orientações do evento.",
  whatsapp_group_url: "https://chat.whatsapp.com/H8wFKHIVebYIH2tOU80wNU?s=cl&p=a&mlu=4&ilr=4",
  status: "published",
};

// Completa campos vazios vindos do banco com o padrão (a página nunca fica quebrada).
export function withDefaults(event) {
  return {
    ...EMPTY_EVENT,
    ...event,
    tags: event?.tags || [],
    info: Array.isArray(event?.info) ? event.info : [],
    topics: Array.isArray(event?.topics) ? event.topics : [],
    ask_fields: { ...EMPTY_EVENT.ask_fields, ...(event?.ask_fields || {}) },
  };
}

export function isRegistrationOpen(event, count = 0) {
  if (event.status !== "published") return false;
  if (event.registration_deadline && new Date(event.registration_deadline) <= new Date()) return false;
  if (event.capacity && count >= event.capacity) return false;
  return true;
}

export function toCsv(rows) {
  const headers = ["Nome", "WhatsApp", "E-mail", "Cidade", "Profissão", "Experiência APH", "Objetivo", "Origem", "Inscrito em"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = rows.map((row) =>
    [
      row.full_name,
      row.whatsapp,
      row.email,
      row.city,
      row.occupation,
      labelFor(EXPERIENCE_OPTIONS, row.aph_experience),
      labelFor(GOAL_OPTIONS, row.main_goal),
      row.source,
      new Date(row.created_at).toLocaleString("pt-BR"),
    ].map(escape).join(",")
  );
  return [headers.map(escape).join(","), ...lines].join("\n");
}
