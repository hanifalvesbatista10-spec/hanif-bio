// Abertura cinematográfica da home: textos padrão, mídia e mesclagem com o que o painel salvar.
//
// O painel grava tudo em site_settings.cinematic (jsonb, SQL 65). Campo vazio ou ausente cai neste padrão, então a abertura
// nunca fica sem texto nem sem imagem, mesmo se o banco ainda não tiver a coluna.
//
// Nos títulos, o trecho entre **asteriscos** sai em vermelho (ex.: "A emergência **não espera.**").

// Mídia: cada cena tem a versão de computador e a de celular (recorte próprio, não só a mesma imagem menor).
export const DEFAULT_MEDIA = {
  // Cena de abertura (e da aproximação do "preparo").
  opening: {
    desktop: "/media/hero/hero-desktop-poster.webp",
    desktopSet: "/media/hero/hero-desktop-poster.webp 1920w, /media/hero/hero-desktop-poster-4k.webp 3840w",
    mobile: "/media/cinematic/abertura-mobile.webp",
    alt: "Hanif Alves, instrutor de APH, de braços cruzados em um ambiente de atendimento",
  },
  // No celular a etapa "preparo" troca para um recorte vertical da sala de treinamento (manequim em maca).
  prep: {
    mobile: "/media/cinematic/preparo-mobile.webp",
  },
  // Cena de treinamento: sala de simulação com manequim.
  training: {
    desktop: "/media/cinematic/treinamento-desktop.webp",
    mobile: "/media/cinematic/treinamento-mobile.webp",
    alt: "Hanif Alves em sala de treinamento, com manequim de simulação em maca ao fundo",
  },
};

export const DEFAULT_TEXT = {
  kicker: "APH Hardcore · Formação em atendimento pré-hospitalar",
  title1: "A emergência **não espera.**",
  support1: "Formação em atendimento pré-hospitalar para desenvolver preparo, raciocínio e decisão.",
  primary_label: "Explorar cursos",
  primary_href: "#produtos",
  secondary_label: "Conhecer a mentoria",
  // vazio = automático: página do produto de mentoria ativo no cadastro (ou o catálogo, se não houver)
  secondary_href: "",
  title2: "O preparo **começa antes.**",
  support2: "",
  title3: "Treine o raciocínio. **Desenvolva suas decisões.**",
  support3: "Cursos, materiais e mentoria para praticar a decisão antes do atendimento real.",
  title4: "Encontre seu **próximo passo** no APH.",
  support4: "",
  cta4_label: "Ver formações disponíveis",
  cta4_href: "#produtos",
};

const text = (value, fallback) => (typeof value === "string" && value.trim() ? value.trim() : fallback);

// Só aceita destinos internos ("/..." ou "#...") ou https; qualquer outra coisa (javascript:, etc.) volta ao padrão.
const safeHref = (value, fallback) => {
  const href = text(value, fallback);
  return /^(\/(?!\/)|#|https:\/\/)/i.test(href) ? href : fallback;
};

const safeImage = (value, fallback) => {
  const src = text(value, "");
  return /^(\/(?!\/)|https:\/\/)/i.test(src) ? src : fallback;
};

// settings.cinematic pode vir nulo (coluna ausente ou nunca editada).
export function resolveCinematic(settings) {
  const raw = settings?.cinematic && typeof settings.cinematic === "object" ? settings.cinematic : {};
  const t = DEFAULT_TEXT;
  return {
    enabled: raw.enabled !== false,
    kicker: text(raw.kicker, t.kicker),
    title1: text(raw.title1, t.title1),
    support1: text(raw.support1, t.support1),
    primaryLabel: text(raw.primary_label, t.primary_label),
    primaryHref: safeHref(raw.primary_href, t.primary_href),
    secondaryLabel: text(raw.secondary_label, t.secondary_label),
    secondaryHref: safeHref(raw.secondary_href, t.secondary_href),
    title2: text(raw.title2, t.title2),
    support2: text(raw.support2, t.support2),
    title3: text(raw.title3, t.title3),
    support3: text(raw.support3, t.support3),
    title4: text(raw.title4, t.title4),
    support4: text(raw.support4, t.support4),
    cta4Label: text(raw.cta4_label, t.cta4_label),
    cta4Href: safeHref(raw.cta4_href, t.cta4_href),
    media: {
      opening: {
        ...DEFAULT_MEDIA.opening,
        // imagem trocada pelo painel: vale a mesma para os dois tamanhos, sem o conjunto de resoluções do padrão
        ...(raw.opening_desktop ? { desktop: safeImage(raw.opening_desktop, DEFAULT_MEDIA.opening.desktop), desktopSet: undefined } : {}),
        mobile: safeImage(raw.opening_mobile, DEFAULT_MEDIA.opening.mobile),
      },
      prep: { mobile: safeImage(raw.prep_mobile, DEFAULT_MEDIA.prep.mobile) },
      training: {
        ...DEFAULT_MEDIA.training,
        desktop: safeImage(raw.training_desktop, DEFAULT_MEDIA.training.desktop),
        mobile: safeImage(raw.training_mobile, DEFAULT_MEDIA.training.mobile),
      },
    },
  };
}

// "A emergência **não espera.**" -> [{ text: "A emergência " }, { text: "não espera.", accent: true }]
export function splitAccent(value) {
  return String(value || "")
    .split(/\*\*(.+?)\*\*/g)
    .map((part, index) => ({ text: part, accent: index % 2 === 1 }))
    .filter((part) => part.text);
}

// Mesmo texto sem as marcas, para rótulos de acessibilidade e metadados.
export const plainText = (value) => String(value || "").replace(/\*\*/g, "");
