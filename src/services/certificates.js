// Certificados: modelos (arte + textos posicionados), desenho em canvas, PDF e ZIP.
// Tudo roda no navegador; o Supabase guarda só modelos e certificados emitidos.

export const FONTS = [
  { value: "Great Vibes", label: "Assinatura elegante (Great Vibes)", css: '"Great Vibes", cursive' },
  { value: "Dancing Script", label: "Manuscrita (Dancing Script)", css: '"Dancing Script", cursive' },
  { value: "Playfair Display", label: "Serifada clássica (Playfair)", css: '"Playfair Display", Georgia, serif' },
  { value: "Cormorant Garamond", label: "Serifada fina (Cormorant)", css: '"Cormorant Garamond", Georgia, serif' },
  { value: "Montserrat", label: "Moderna (Montserrat)", css: '"Montserrat", Arial, sans-serif' },
  { value: "Barlow Semi Condensed", label: "Condensada (Barlow)", css: '"Barlow Semi Condensed", Arial, sans-serif' },
  { value: "Georgia", label: "Georgia", css: "Georgia, serif" },
  { value: "Arial", label: "Arial", css: "Arial, Helvetica, sans-serif" },
];

export const MAX_SIDE = 3508; // A4 a 300 dpi no lado maior
export const BATCH_LIMIT = 300;

export const BUILTIN_VARS = ["codigo", "link", "emissao"];

export const DEFAULT_QR = { enabled: false, x: 91, y: 86, size: 9 };

export const BLOCK_PRESETS = [
  { label: "Nome do aluno", block: { text: "{nome}", x: 50, y: 46, size: 62, font: "Great Vibes", weight: "400", maxWidth: 70, fit: "shrink", color: "#0b1b2d" } },
  { label: "Curso", block: { text: "{curso}", x: 50, y: 60, size: 26, font: "Playfair Display", weight: "700", maxWidth: 70, fit: "shrink", color: "#0b1b2d" } },
  { label: "Texto do certificado", block: { text: "concluiu o curso {curso}, com carga horária de {carga_horaria}.", x: 50, y: 56, size: 20, font: "Montserrat", weight: "400", maxWidth: 62, fit: "wrap", color: "#26384b" } },
  { label: "Carga horária", block: { text: "Carga horária: {carga_horaria}", x: 50, y: 68, size: 18, font: "Montserrat", weight: "600", maxWidth: 60, fit: "shrink", color: "#26384b" } },
  { label: "Data", block: { text: "{data}", x: 50, y: 76, size: 18, font: "Montserrat", weight: "400", maxWidth: 50, fit: "shrink", color: "#26384b" } },
  { label: "Código de verificação", block: { text: "Código: {codigo}", x: 12, y: 93, size: 13, font: "Montserrat", weight: "400", maxWidth: 40, fit: "shrink", color: "#5b6b7c", align: "left" } },
  { label: "Parágrafo justificado (texto corrido)", block: { text: "Certificamos que **{nome}** concluiu o curso **{curso}**, com carga horária de **{carga_horaria}**.", x: 50, y: 52, size: 22, font: "Montserrat", weight: "400", align: "justify", maxWidth: 80, fit: "wrap", lineHeight: 1.5, color: "#111111" } },
  { label: "Texto livre", block: { text: "Seu texto aqui", x: 50, y: 50, size: 20, font: "Montserrat", weight: "400", maxWidth: 60, fit: "wrap", color: "#26384b" } },
];

// Pontos de partida para cada página nova. As posições seguem os modelos do IMAPH (certificado com
// parágrafo e carteirinha "SOCORRISTA"): é só enviar o plano de fundo e o texto já cai no lugar.
export function starterBlocks(kind) {
  if (kind === "certificado") {
    return [
      newBlock({
        text: "Certificamos para devidos fins, que o(a) senhor(a) **{nome} - CPF: {cpf}**, concluiu com êxito o Curso Livre de Capacitação Profissional de **{curso}**, realizado no período de **{periodo}**, cumprindo a carga horária de **{carga_horaria}**, com **aproveitamento de {aproveitamento} na modalidade {modalidade}**.",
        x: 49.6, y: 51, size: 23, font: "Montserrat", align: "justify", maxWidth: 91, fit: "wrap", lineHeight: 1.45, color: "#111111",
      }),
      newBlock({ text: "{data}", x: 38, y: 71, size: 15, font: "Montserrat", weight: "700", maxWidth: 40, color: "#111111" }),
      newBlock({ text: "Código: {codigo}", x: 4, y: 96.5, size: 11, font: "Montserrat", align: "left", maxWidth: 40, color: "#5b6b7c" }),
    ];
  }
  if (kind === "carteirinha") {
    const left = (text, y) => newBlock({ text, x: 6.7, y, size: 29, font: "Montserrat", weight: "700", align: "left", maxWidth: 57, uppercase: true, color: "#111111" });
    const center = (text, x, y) => newBlock({ text, x, y, size: 26, font: "Montserrat", weight: "700", align: "center", maxWidth: 24, uppercase: true, color: "#111111" });
    return [
      left("{nome}", 42),
      left("{cpf}", 53.2),
      left("{rg}", 65.5),
      center("{data}", 19.5, 77.6),
      center("{carga_horaria}", 51.3, 77.6),
      center("{validade}", 19.7, 89.3),
      center("{tipo_sanguineo}", 51.3, 89.3),
      newBlock({ type: "photo", x: 82.9, y: 66.3, width: 28.7, ratio: 1.37, radius: 3, text: "" }),
    ];
  }
  if (kind === "paragrafo") {
    return [
      newBlock({
        text: "Certificamos que **{nome}** participou de **{curso}**, realizado em **{data}**, com carga horária de **{carga_horaria}**.",
        x: 50, y: 48, size: 24, font: "Montserrat", align: "justify", maxWidth: 80, fit: "wrap", lineHeight: 1.5, color: "#111111",
      }),
      ...signatureBlocks(0),
      newBlock({ text: "Código: {codigo}", x: 4, y: 96.5, size: 11, font: "Montserrat", align: "left", maxWidth: 40, color: "#5b6b7c" }),
    ];
  }
  return [];
}

// Traço (linha) para assinatura, divisórias ou sublinhados. x/y = centro; width em % da largura da arte.
export function lineBlock(partial = {}) {
  return newBlock({ type: "line", text: "", x: 50, y: 84, width: 24, thickness: 2, color: "#111111", lineStyle: "solid", ...partial });
}

// Assinatura completa: traço + nome do facilitador + cargo. Cada assinatura extra ocupa outro ponto da
// página e usa o próprio campo ({facilitador2}, {facilitador3}...), para trocar o nome por certificado.
const SIGNATURE_SLOTS = [50, 25, 75, 12, 88];
export function signatureBlocks(count = 0) {
  const x = SIGNATURE_SLOTS[count % SIGNATURE_SLOTS.length];
  const key = count === 0 ? "facilitador" : `facilitador${count + 1}`;
  return [
    lineBlock({ x, y: 84 }),
    newBlock({ text: `{${key}}`, x, y: 86.6, size: 15, font: "Montserrat", weight: "700", maxWidth: 28, color: "#111111" }),
    newBlock({ text: "Facilitador", x, y: 89.2, size: 12, font: "Montserrat", weight: "400", maxWidth: 28, color: "#26384b" }),
  ];
}

export const PAGE_STARTERS = [
  { id: "certificado", label: "Certificado com parágrafo (como o modelo do IMAPH)" },
  { id: "carteirinha", label: "Carteirinha SOCORRISTA (campos + foto, como o modelo do IMAPH)" },
  { id: "paragrafo", label: "Parágrafo novo + assinatura do facilitador (você escreve o texto)" },
  { id: "branco", label: "Página em branco" },
];

export function newBlock(partial = {}) {
  return {
    id: `b${Math.random().toString(36).slice(2, 9)}`,
    type: "text", // text | image | photo
    text: "{nome}",
    x: 50,
    y: 50,
    size: 30, // décimos de % da largura da arte (30 = 3% da largura)
    color: "#0b1b2d",
    font: "Montserrat",
    weight: "400",
    align: "center",
    maxWidth: 70, // % da largura
    fit: "shrink", // shrink = reduz para caber em uma linha; wrap = quebra em linhas
    lineHeight: 1.3,
    uppercase: false,
    ...partial,
  };
}

// ---------------------------------------------------------------- páginas (frente, verso, carteirinha...)

export function newPageId() {
  return `p${Math.random().toString(36).slice(2, 8)}`;
}

// Modelos antigos (1 página) continuam funcionando: viram uma página só.
export function getPages(template) {
  if (Array.isArray(template.pages) && template.pages.length > 0) {
    return template.pages.map((page, index) => ({
      id: page.id || `p${index + 1}`,
      name: page.name || `Página ${index + 1}`,
      background_url: page.background_url,
      background_path: page.background_path || null,
      width: page.width,
      height: page.height,
      blocks: page.blocks || [],
      qr: { ...DEFAULT_QR, ...(page.qr || {}) },
    }));
  }
  return [
    {
      id: "p1",
      name: "Página 1",
      background_url: template.background_url,
      background_path: template.background_path || null,
      width: template.width,
      height: template.height,
      blocks: template.blocks || [],
      qr: { ...DEFAULT_QR, ...(template.qr || {}) },
    },
  ];
}

// Páginas incluídas em um certificado emitido (data.__pages = ids; ausente = todas).
export function activePages(template, data) {
  const pages = getPages(template);
  const ids = data?.__pages;
  const chosen = Array.isArray(ids) && ids.length > 0 ? pages.filter((page) => ids.includes(page.id)) : pages;
  return chosen.length > 0 ? chosen : pages;
}

export function templateVariables(template) {
  const found = [];
  getPages(template).forEach((page) => extractVariables(page.blocks).forEach((key) => !found.includes(key) && found.push(key)));
  return found;
}

export function usesPhoto(template) {
  return getPages(template).some((page) => page.blocks.some((block) => block.type === "photo"));
}

// Formata alguns campos comuns ao emitir (CPF vira 000.000.000-00).
export function formatValue(key, value) {
  const text = String(value ?? "").trim();
  if (key === "cpf") {
    const digits = text.replace(/\D/g, "");
    if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return text;
}

export function slug(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "certificado";
}

export function varKey(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const LABELS = {
  curso: "Curso",
  facilitador: "Facilitador",
  carga_horaria: "Carga horária",
  data: "Data",
  data_conclusao: "Data de conclusão",
  periodo: "Período",
  instrutor: "Instrutor",
  cidade: "Cidade",
  local: "Local",
  turma: "Turma",
  nota: "Nota",
  cpf: "CPF",
  matricula: "Matrícula",
  descricao: "Descrição",
  rg: "RG",
  validade: "Validade",
  tipo_sanguineo: "Tipo sanguíneo",
  modalidade: "Modalidade",
  aproveitamento: "Aproveitamento",
  foto: "Foto",
};

export function humanize(key) {
  if (LABELS[key]) return LABELS[key];
  const numbered = /^(facilitador)(\d+)$/.exec(String(key));
  if (numbered) return `Facilitador ${numbered[2]}`;
  const text = String(key || "").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Variáveis escritas como {nome} nos textos (menos as automáticas).
export function extractVariables(blocks = []) {
  const found = new Set();
  blocks.forEach((block) => {
    if ((block.type || "text") !== "text") return;
    for (const match of String(block.text || "").matchAll(/\{([a-z0-9_]+)\}/gi)) {
      const key = varKey(match[1]);
      if (key && !BUILTIN_VARS.includes(key)) found.add(key);
    }
  });
  found.delete("nome"); // o nome do aluno sempre existe como campo próprio
  found.delete("foto"); // a foto tem campo próprio
  return [...found];
}

export function applyValues(text, values = {}) {
  return String(text || "").replace(/\{([a-z0-9_]+)\}/gi, (_, key) => {
    const value = values[varKey(key)];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function formatDatePt(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function verifyUrl(code) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/certificado/${code}`;
}

// Valores de exemplo para pré-visualizar o modelo.
export function sampleValues(template) {
  const values = { nome: "Maria da Silva Santos", codigo: "HA-3F9A1-C07BE", emissao: formatDatePt(), link: verifyUrl("HA-3F9A1-C07BE") };
  templateVariables(template).forEach((key) => {
    values[key] = template.defaults?.[key] || (key.includes("hora") ? "40 horas" : key === "data" ? formatDatePt() : `[${humanize(key)}]`);
  });
  return values;
}

// ---------------------------------------------------------------- imagens / fontes

const imageCache = new Map();

export function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => {
          imageCache.delete(url);
          reject(new Error("Não foi possível carregar a arte do certificado."));
        };
        image.src = url;
      })
    );
  }
  return imageCache.get(url);
}

export async function ensureFonts(blocks = []) {
  if (typeof document === "undefined" || !document.fonts) return;
  const wanted = new Set(blocks.map((block) => `${block.weight || "400"} 40px "${block.font}"`));
  await Promise.all([...wanted].map((spec) => document.fonts.load(spec).catch(() => null)));
  await document.fonts.ready;
}

const qrCache = new Map();

async function qrImage(link, pixels) {
  const key = `${link}|${pixels}`;
  if (!qrCache.has(key)) {
    qrCache.set(
      key,
      (async () => {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(link, { margin: 0, width: pixels, color: { dark: "#0b1b2d", light: "#ffffff00" } });
        return loadImage(dataUrl);
      })()
    );
  }
  return qrCache.get(key);
}

// ---------------------------------------------------------------- desenho

// Texto com **negrito** (trechos entre dois asteriscos duplos) e quebras de linha.
// Uma "palavra" pode misturar estilos (ex.: **CPF**, com a vírgula colada): ela vira vários trechos.
function parseRich(text) {
  const tokens = [];
  let bold = false;
  let current = null;
  const flush = () => {
    if (current) tokens.push(current);
    current = null;
  };
  String(text).split("**").forEach((part, index) => {
    if (index > 0) bold = !bold;
    part.split(/(\n|[^\S\n]+)/).forEach((piece) => {
      if (piece === "") return;
      if (piece === "\n") {
        flush();
        tokens.push({ type: "break" });
      } else if (/^\s+$/.test(piece)) flush();
      else {
        if (!current) current = { type: "word", runs: [] };
        current.runs.push({ text: piece, bold });
      }
    });
  });
  flush();
  return tokens;
}

function buildLines(ctx, tokens, size, style, maxW, wrap) {
  const fontFor = (bold) => `${bold ? "700" : style.weight} ${size}px ${style.family}`;
  ctx.font = fontFor(false);
  const space = ctx.measureText(" ").width;
  const lines = [];
  let current = { words: [], width: 0, endsParagraph: false };
  const push = (end) => {
    current.endsParagraph = end;
    lines.push(current);
    current = { words: [], width: 0, endsParagraph: false };
  };
  tokens.forEach((token) => {
    if (token.type === "break") {
      push(true);
      return;
    }
    const w = token.runs.reduce((sum, run) => {
      ctx.font = fontFor(run.bold);
      return sum + ctx.measureText(run.text).width;
    }, 0);
    const added = current.words.length ? space + w : w;
    if (wrap && current.words.length && current.width + added > maxW) {
      push(false);
      current.words.push({ ...token, w });
      current.width = w;
    } else {
      current.words.push({ ...token, w });
      current.width += added;
    }
  });
  push(true);
  return { lines, space, fontFor };
}

// Desenha um bloco de texto e devolve a caixa ocupada (em pixels do canvas).
export function drawBlock(ctx, block, values, canvasW, canvasH) {
  let text = applyValues(block.text, values).trim();
  if (block.uppercase) text = text.toUpperCase();
  if (!text) return { id: block.id, box: null };

  const fontDef = FONTS.find((font) => font.value === block.font);
  const style = { family: fontDef?.css || `"${block.font}", sans-serif`, weight: block.weight || "400" };
  const align = block.align || "center";
  const justify = align === "justify";
  const basePx = (Number(block.size) / 1000) * canvasW;
  const maxW = (Number(block.maxWidth) / 100) * canvasW;
  const lineHeight = Number(block.lineHeight) || 1.3;
  const tokens = parseRich(text);

  let size = basePx;
  let layout = buildLines(ctx, tokens, size, style, maxW, block.fit === "wrap" || justify);
  if (!justify && block.fit !== "wrap") {
    const widest = (l) => Math.max(...l.lines.map((line) => line.width));
    // reduz a fonte até caber em uma linha (no mínimo 45% do tamanho)
    while (widest(layout) > maxW && size > basePx * 0.45) {
      size *= 0.97;
      layout = buildLines(ctx, tokens, size, style, maxW, false);
    }
    if (widest(layout) > maxW) layout = buildLines(ctx, tokens, size, style, maxW, true);
  }

  const { lines, space, fontFor } = layout;
  const lh = size * lineHeight;
  const totalH = lines.length * lh;
  const anchorX = (Number(block.x) / 100) * canvasW;
  const top = (Number(block.y) / 100) * canvasH - totalH / 2;

  ctx.fillStyle = block.color || "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  let boxLeft = Infinity;
  let boxRight = -Infinity;
  lines.forEach((line, index) => {
    const y = top + (index + 0.5) * lh;
    let gap = space;
    let x;
    if (justify) {
      x = anchorX - maxW / 2;
      if (!line.endsParagraph && line.words.length > 1) {
        const wordsWidth = line.words.reduce((sum, word) => sum + word.w, 0);
        gap = (maxW - wordsWidth) / (line.words.length - 1);
      }
    } else if (align === "center") x = anchorX - line.width / 2;
    else if (align === "right") x = anchorX - line.width;
    else x = anchorX;
    const start = x;
    line.words.forEach((word) => {
      let runX = x;
      word.runs.forEach((run) => {
        ctx.font = fontFor(run.bold);
        ctx.fillText(run.text, runX, y);
        runX += ctx.measureText(run.text).width;
      });
      x += word.w + gap;
    });
    boxLeft = Math.min(boxLeft, start);
    boxRight = Math.max(boxRight, justify ? start + maxW : start + line.width);
  });

  return { id: block.id, box: { x: boxLeft, y: top, w: boxRight - boxLeft, h: totalH } };
}

async function drawImageBlock(ctx, block, canvasW, canvasH) {
  if (!block.image_url) return { id: block.id, box: null };
  const image = await loadImage(block.image_url).catch(() => null);
  if (!image) return { id: block.id, box: null };
  const w = (Number(block.width) / 100) * canvasW;
  const h = (w * image.naturalHeight) / image.naturalWidth;
  const x = (Number(block.x) / 100) * canvasW - w / 2;
  const y = (Number(block.y) / 100) * canvasH - h / 2;
  ctx.save();
  ctx.globalAlpha = block.opacity === undefined ? 1 : Number(block.opacity);
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  return { id: block.id, box: { x, y, w, h } };
}

function drawLineBlock(ctx, block, canvasW, canvasH) {
  const w = (Number(block.width) / 100) * canvasW;
  const thick = Math.max(1, (Number(block.thickness) || 2) * (canvasW / 1000));
  const cx = (Number(block.x) / 100) * canvasW;
  const cy = (Number(block.y) / 100) * canvasH;
  ctx.save();
  ctx.globalAlpha = block.opacity === undefined ? 1 : Number(block.opacity);
  ctx.strokeStyle = block.color || "#111111";
  ctx.lineWidth = thick;
  ctx.lineCap = block.lineStyle === "dotted" ? "round" : "butt";
  if (block.lineStyle === "dashed") ctx.setLineDash([thick * 6, thick * 4]);
  else if (block.lineStyle === "dotted") ctx.setLineDash([0, thick * 2.5]);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx + w / 2, cy);
  ctx.stroke();
  ctx.restore();
  // a caixa de arraste é mais alta que o traço para ser fácil de pegar
  const hitH = Math.max(thick, canvasW * 0.014);
  return { id: block.id, box: { x: cx - w / 2, y: cy - hitH / 2, w, h: hitH } };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Caixa da foto do participante (valor "foto" = URL da imagem). Sem foto, deixa a arte como está.
async function drawPhotoBlock(ctx, block, values, canvasW, canvasH, placeholders) {
  const w = (Number(block.width) / 100) * canvasW;
  const h = w * (Number(block.ratio) || 1.25);
  const x = (Number(block.x) / 100) * canvasW - w / 2;
  const y = (Number(block.y) / 100) * canvasH - h / 2;
  const radius = ((Number(block.radius) || 0) / 100) * w;
  const box = { x, y, w, h };
  const image = values.foto ? await loadImage(values.foto).catch(() => null) : null;
  if (image) {
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  } else if (placeholders) {
    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = Math.max(2, canvasW / 700);
    ctx.strokeStyle = "rgba(11,27,45,0.45)";
    roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();
    ctx.fillStyle = "rgba(11,27,45,0.4)";
    ctx.font = `700 ${w * 0.16}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FOTO", x + w / 2, y + h / 2);
    ctx.restore();
  }
  return { id: block.id, box };
}

// Renderiza UMA página do certificado. Retorna { canvas, metrics }.
export async function renderCertificate({ template, page, pageIndex = 0, values, canvas, maxSide = MAX_SIDE, withQr = true, placeholders = false }) {
  const pg = page || getPages(template)[pageIndex];
  const image = await loadImage(pg.background_url);
  await ensureFonts(pg.blocks.filter((block) => (block.type || "text") === "text"));

  const scale = Math.min(1, maxSide / Math.max(pg.width, pg.height));
  const width = Math.round(pg.width * scale);
  const height = Math.round(pg.height * scale);
  const target = canvas || document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const metrics = [];
  for (const block of pg.blocks) {
    const type = block.type || "text";
    if (type === "image") metrics.push(await drawImageBlock(ctx, block, width, height));
    else if (type === "photo") metrics.push(await drawPhotoBlock(ctx, block, values, width, height, placeholders));
    else if (type === "line") metrics.push(drawLineBlock(ctx, block, width, height));
    else metrics.push(drawBlock(ctx, block, values, width, height));
  }

  const qr = { ...DEFAULT_QR, ...(pg.qr || {}) };
  if (withQr && qr.enabled) {
    const size = Math.round((Number(qr.size) / 100) * width);
    const qrCanvasImage = await qrImage(values.link || verifyUrl(values.codigo || ""), Math.max(size, 64));
    const x = (Number(qr.x) / 100) * width - size / 2;
    const y = (Number(qr.y) / 100) * height - size / 2;
    ctx.drawImage(qrCanvasImage, x, y, size, size);
    metrics.push({ id: "__qr", box: { x, y, w: size, h: size } });
  }

  return { canvas: target, metrics };
}

// ---------------------------------------------------------------- PDF / ZIP / download

function pdfDims(canvas) {
  const landscape = canvas.width >= canvas.height;
  const long = 297;
  return {
    orientation: landscape ? "landscape" : "portrait",
    pageW: landscape ? long : (long * canvas.width) / canvas.height,
    pageH: landscape ? (long * canvas.height) / canvas.width : long,
  };
}

// Acrescenta ao PDF todas as páginas de um certificado (frente, verso, carteirinha...).
async function addCertificatePages(doc, JsPDF, { template, certificate }, { maxSide, quality }) {
  const values = valuesForCertificate(certificate);
  let target = doc;
  for (const page of activePages(template, certificate.data)) {
    const { canvas } = await renderCertificate({ template, page, values, maxSide });
    const dims = pdfDims(canvas);
    if (!target) target = new JsPDF({ orientation: dims.orientation, unit: "mm", format: [dims.pageW, dims.pageH], compress: true });
    else target.addPage([dims.pageW, dims.pageH], dims.orientation);
    target.addImage(canvas.toDataURL("image/jpeg", quality), "JPEG", 0, 0, dims.pageW, dims.pageH, undefined, "FAST");
  }
  return target;
}

// PDF de UM certificado (todas as páginas incluídas).
export async function renderPdf({ template, certificate }) {
  const { jsPDF } = await import("jspdf");
  const doc = await addCertificatePages(null, jsPDF, { template, certificate }, { maxSide: MAX_SIDE, quality: 0.92 });
  return doc.output("blob");
}

export function certificateFileName(recipient, code, ext = "pdf") {
  return `certificado-${slug(recipient)}-${code}.${ext}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Valores completos de um certificado emitido (nome + dados + automáticos).
export function valuesForCertificate(certificate) {
  return {
    ...(certificate.data || {}),
    nome: certificate.recipient_name,
    codigo: certificate.code,
    link: verifyUrl(certificate.code),
    emissao: formatDatePt(certificate.issued_at),
  };
}

// Gera vários PDFs e junta em um ZIP (um PDF por pessoa), reportando o progresso.
export async function buildZip({ items, onProgress }) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let index = 0; index < items.length; index += 1) {
    const blob = await renderPdf(items[index]);
    zip.file(certificateFileName(items[index].certificate.recipient_name, items[index].certificate.code), blob);
    onProgress?.(index + 1, items.length);
    // respira para a interface não travar
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

// PDF único com todas as páginas de todos os certificados.
export async function buildMergedPdf({ items, onProgress }) {
  const { jsPDF } = await import("jspdf");
  let doc = null;
  for (let index = 0; index < items.length; index += 1) {
    doc = await addCertificatePages(doc, jsPDF, items[index], { maxSide: 2480, quality: 0.88 });
    onProgress?.(index + 1, items.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return doc.output("blob");
}

// ---------------------------------------------------------------- tabela colada / CSV

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((value) => value.trim())).filter((r) => r.some((value) => value !== ""));
}

const HEADER_ALIASES = { nome: ["nome", "name", "aluno", "participante", "nome_completo"], email: ["email", "e_mail", "mail"] };

function canonicalHeader(header, knownVars) {
  const key = varKey(header);
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) if (aliases.includes(key)) return canonical;
  return knownVars.includes(key) ? key : null;
}

// Lê texto colado do Excel/Sheets ou CSV. Se a 1ª linha tiver cabeçalhos conhecidos, usa as colunas;
// senão trata cada linha como um nome. Retorna { rows: [{nome,email,...}], ignored: [colunas]}.
export function parsePastedTable(text, variableKeys = []) {
  const clean = String(text || "").replace(/^﻿/, "");
  if (!clean.trim()) return { rows: [], ignored: [], hasHeader: false };
  const firstLine = clean.split(/\r?\n/)[0];
  const delimiter = [["\t", firstLine.split("\t").length], [";", firstLine.split(";").length], [",", firstLine.split(",").length]].sort((a, b) => b[1] - a[1])[0][0];
  const table = parseDelimited(clean, delimiter);
  if (table.length === 0) return { rows: [], ignored: [], hasHeader: false };

  const headers = table[0].map((header) => canonicalHeader(header, variableKeys));
  const hasHeader = headers.includes("nome");
  if (!hasHeader) {
    return { rows: table.map((cells) => ({ nome: cells[0] || "", email: cells[1]?.includes("@") ? cells[1] : "" })), ignored: [], hasHeader: false };
  }
  const ignored = table[0].filter((_, index) => !headers[index]);
  const rows = table.slice(1).map((cells) => {
    const entry = {};
    headers.forEach((key, index) => {
      if (key) entry[key] = cells[index] || "";
    });
    return entry;
  });
  return { rows, ignored, hasHeader };
}

export function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---------------------------------------------------------------- arte de fundo

export function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    image.src = url;
  });
}

export function isMissingCertTables(error) {
  const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return (text.includes("certificate") || text.includes("get_certificate")) &&
    (text.includes("does not exist") || text.includes("pgrst205") || text.includes("pgrst202") || text.includes("42p01") || text.includes("could not find"));
}
