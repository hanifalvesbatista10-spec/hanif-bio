// Coleta do Radar de Evidências. Só consulta fontes oficiais, por interfaces públicas:
//  * PubMed (NCBI E-utilities): busca por tema + registro completo (título, autores, DOI, PMID, datas, resumo);
//  * NAEMSP: feed RSS público;
//  * ILCOR CoSTR: página pública (o site não tem feed, API nem datas).
// AHA, ERC e ACS-COT não têm feed e o site da AHA bloqueia acesso automatizado (403): não é contornado. O que essas
// entidades publicam em revistas (Circulation, Resuscitation, J Trauma Acute Care Surg...) chega pelo PubMed.
// TUDO que vem da internet é dado NÃO CONFIÁVEL: aqui só se extrai texto e se limpa; nada é executado ou obedecido.

const UA = "hanif-bio-radar/1.0 (+https://www.aphhardcore.com)";
const ALLOWED_HOSTS = new Set(["eutils.ncbi.nlm.nih.gov", "pubmed.ncbi.nlm.nih.gov", "costr.ilcor.org", "naemsp.org", "www.naemsp.org"]);
const MAX_BYTES = 900_000;
const NCBI_GAP_MS = process.env.NCBI_API_KEY ? 120 : 380; // limite do NCBI: 3 req/s sem chave, 10 com chave

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// GET com lista de sites permitidos, só https, no máximo 3 redirecionamentos (conferindo o site a cada um),
// tempo e tamanho limitados. Devolve null se algo estiver fora da regra.
export async function safeGet(url, { timeoutMs = 12000 } = {}) {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    let parsed;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) return null;
    const response = await fetch(parsed, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xml,application/json;q=0.9,*/*;q=0.5" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get("location");
      if (!next) return null;
      current = new URL(next, parsed).href;
      continue;
    }
    if (!response.ok) return { ok: false, status: response.status, text: "" };
    const buffer = await response.arrayBuffer();
    return { ok: true, status: response.status, text: new TextDecoder().decode(buffer.slice(0, MAX_BYTES)) };
  }
  return null;
}

// ---------------------------------------------------------------- limpeza de texto

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

export function stripHtml(html) {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function toIsoDate(year, month, day) {
  if (!year) return null;
  const m = typeof month === "string" && /^[a-z]/i.test(month) ? MONTHS[month.slice(0, 3).toLowerCase()] : Number(month) || 1;
  const d = Number(day) || 1;
  const date = new Date(Date.UTC(Number(year), (m || 1) - 1, d));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- PubMed

const TYPES =
  '(guideline[pt] OR "practice guideline"[pt] OR "randomized controlled trial"[pt] OR "systematic review"[pt] OR "meta-analysis"[pt] OR "consensus development conference"[pt] OR "observational study"[pt] OR "multicenter study"[pt] OR review[pt])';

export const TOPICS = {
  rcp_dea: "RCP e DEA",
  trauma_hemorragia: "Trauma, hemorragia e choque",
  pediatria_neonatal: "Pediatria e neonatal",
  coluna: "Restrição de movimento da coluna",
};

// Consultas por tema, em inglês e em português. Os termos vão no título ([ti]) ou em MeSH para não trazer estudo que
// só menciona o assunto de passagem; a triagem por IA ainda confere a relevância depois.
const PUBMED_QUERIES = [
  { topic: "rcp_dea", term: `("Heart Arrest"[Mesh] OR "Cardiopulmonary Resuscitation"[Mesh] OR "cardiac arrest"[ti] OR resuscitation[ti] OR defibrillat*[ti] OR "automated external defibrillator"[ti]) AND ${TYPES}` },
  { topic: "rcp_dea", term: `("parada cardiorrespiratória"[tiab] OR "parada cardíaca"[tiab] OR "ressuscitação cardiopulmonar"[tiab] OR desfibrila*[tiab]) AND (por[la] OR Brazil[ad])` },
  { topic: "trauma_hemorragia", term: `(hemorrhag*[ti] OR tourniquet*[ti] OR "hemorrhagic shock"[ti] OR "damage control resuscitation"[ti] OR trauma[ti]) AND (prehospital[tiab] OR "emergency medical services"[tiab] OR paramedic*[tiab] OR "out-of-hospital"[tiab]) AND ${TYPES}` },
  { topic: "trauma_hemorragia", term: `(hemorragia[tiab] OR trauma[tiab] OR "choque hemorrágico"[tiab] OR torniquete[tiab]) AND (pré-hospitalar[tiab] OR "atendimento pré-hospitalar"[tiab] OR SAMU[tiab]) AND (por[la] OR Brazil[ad])` },
  { topic: "pediatria_neonatal", term: `(pediatric*[ti] OR paediatric*[ti] OR child*[ti] OR neonat*[ti] OR newborn*[ti] OR infant*[ti]) AND (resuscitation[ti] OR "cardiac arrest"[ti] OR "life support"[ti] OR "emergency"[ti] OR prehospital[tiab]) AND ${TYPES}` },
  { topic: "pediatria_neonatal", term: `(pediátrica[tiab] OR pediátrico[tiab] OR neonatal[tiab] OR "recém-nascido"[tiab]) AND (ressuscitação[tiab] OR "parada cardiorrespiratória"[tiab] OR emergência[tiab]) AND (por[la] OR Brazil[ad])` },
  { topic: "coluna", term: `("spinal motion restriction"[tiab] OR "spinal immobili*"[tiab] OR "cervical spine"[ti] OR "c-spine"[tiab] OR NEXUS[tiab] OR "Canadian C-Spine"[tiab]) AND (prehospital[tiab] OR emergency[tiab] OR trauma[tiab]) AND ${TYPES}` },
  { topic: "coluna", term: `("restrição de movimento da coluna"[tiab] OR "imobilização da coluna"[tiab] OR "coluna cervical"[tiab]) AND (por[la] OR Brazil[ad])` },
];

const ncbi = (path, params) => {
  const query = new URLSearchParams({ ...params, tool: "hanif-bio-radar", email: process.env.NCBI_EMAIL || "contato@aphhardcore.com" });
  if (process.env.NCBI_API_KEY) query.set("api_key", process.env.NCBI_API_KEY);
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${path}?${query}`;
};

const ymd = (date) => `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;

async function pubmedSearch(term, since, retmax) {
  const response = await safeGet(ncbi("esearch.fcgi", { db: "pubmed", term, datetype: "edat", mindate: ymd(since), maxdate: ymd(new Date()), retmax: String(retmax), sort: "date", retmode: "json" }));
  if (!response?.ok) throw new Error(`PubMed (busca) respondeu ${response?.status ?? "bloqueado"}`);
  const ids = JSON.parse(response.text)?.esearchresult?.idlist;
  return Array.isArray(ids) ? ids.filter((id) => /^\d{1,9}$/.test(id)) : [];
}

const tag = (xml, name) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? stripHtml(match[1]) : "";
};

export function parsePubmedXml(xml) {
  const articles = String(xml).split("<PubmedArticle>").slice(1);
  return articles.map((block) => {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    const title = tag(block, "ArticleTitle").replace(/\.$/, "");
    if (!pmid || !title) return null;

    const abstract = [...block.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/gi)]
      .map((m) => {
        const label = m[1].match(/Label="([^"]+)"/)?.[1];
        return `${label ? `${label}: ` : ""}${stripHtml(m[2])}`;
      })
      .join("\n");

    const authors = [...block.matchAll(/<Author\s[^>]*>([\s\S]*?)<\/Author>/gi)]
      .map((m) => {
        const last = tag(m[1], "LastName");
        const initials = tag(m[1], "Initials");
        const collective = tag(m[1], "CollectiveName");
        return collective || (last ? `${last}${initials ? ` ${initials}` : ""}` : "");
      })
      .filter(Boolean);
    const authorsText = authors.length > 6 ? `${authors.slice(0, 6).join(", ")} et al.` : authors.join(", ");

    const doi = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i)?.[1] || block.match(/<ELocationID EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/i)?.[1] || null;
    const pubTypes = [...block.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/gi)].map((m) => decodeEntities(m[1]));
    const journal = tag(block.match(/<Journal>[\s\S]*?<\/Journal>/i)?.[0] || "", "Title") || "PubMed";

    const articleDate = block.match(/<ArticleDate[^>]*>([\s\S]*?)<\/ArticleDate>/i)?.[1];
    const pubDate = block.match(/<PubDate>([\s\S]*?)<\/PubDate>/i)?.[1];
    const dateSource = articleDate || pubDate || "";
    const published = toIsoDate(tag(dateSource, "Year") || null, tag(dateSource, "Month") || 1, tag(dateSource, "Day") || 1);
    const revised = block.match(/<DateRevised>([\s\S]*?)<\/DateRevised>/i)?.[1];
    const updated = revised ? toIsoDate(tag(revised, "Year"), tag(revised, "Month"), tag(revised, "Day")) : null;

    return {
      source_name: `PubMed — ${journal}`,
      source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      pmid,
      doi: doi ? doi.trim() : null,
      title_original: title.slice(0, 500),
      authors: authorsText.slice(0, 400) || null,
      published_date: published,
      updated_date: updated,
      pub_types: pubTypes,
      raw_text: abstract.slice(0, 6000),
    };
  }).filter(Boolean);
}

export async function collectPubmed(since, { maxPerQuery = 12 } = {}) {
  const topicByPmid = new Map();
  for (const query of PUBMED_QUERIES) {
    try {
      const ids = await pubmedSearch(query.term, since, maxPerQuery);
      ids.forEach((id) => {
        if (!topicByPmid.has(id)) topicByPmid.set(id, query.topic);
      });
    } catch (error) {
      console.error("radar pubmed query:", error.message);
    }
    await sleep(NCBI_GAP_MS);
  }
  return { ids: [...topicByPmid.keys()], topicByPmid };
}

export async function fetchPubmedRecords(ids) {
  const records = [];
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    const response = await safeGet(ncbi("efetch.fcgi", { db: "pubmed", id: chunk.join(","), retmode: "xml" }), { timeoutMs: 20000 });
    if (!response?.ok) throw new Error(`PubMed (registros) respondeu ${response?.status ?? "bloqueado"}`);
    records.push(...parsePubmedXml(response.text));
    await sleep(NCBI_GAP_MS);
  }
  return records;
}

// ---------------------------------------------------------------- NAEMSP (RSS)

export async function collectNaemsp(since) {
  const response = await safeGet("https://naemsp.org/feed/");
  if (!response?.ok) throw new Error(`NAEMSP respondeu ${response?.status ?? "bloqueado"}`);
  return [...response.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((m) => {
      const item = m[1];
      const link = tag(item, "link");
      const date = new Date(tag(item, "pubDate"));
      return {
        source_name: "NAEMSP",
        source_url: /^https:\/\/(www\.)?naemsp\.org\//.test(link) ? link.split("#")[0] : null,
        title_original: tag(item, "title").slice(0, 500),
        published_date: Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10),
        updated_date: null,
        pub_types: [],
        raw_text: tag(item, "description").slice(0, 3000),
        analysis_basis: "pagina_da_fonte",
      };
    })
    .filter((item) => item.source_url && item.title_original && (!item.published_date || new Date(item.published_date) >= since));
}

// ---------------------------------------------------------------- ILCOR CoSTR

const ILCOR_STATUS = [
  [/draft for public comment/i, "Rascunho para consulta pública"],
  [/final costr/i, "CoSTR final"],
  [/final draft/i, "Rascunho final"],
];

export async function listIlcorDocuments() {
  const response = await safeGet("https://costr.ilcor.org/document");
  if (!response?.ok) throw new Error(`ILCOR respondeu ${response?.status ?? "bloqueado"}`);
  return [...new Set([...response.text.matchAll(/https:\/\/costr\.ilcor\.org\/document\/[a-z0-9-]+/gi)].map((m) => m[0].toLowerCase()))].slice(0, 12);
}

export const titleFromSlug = (url) =>
  decodeURIComponent(url.split("/").pop() || "").replace(/-/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);

export async function fetchIlcorDocument(url) {
  const response = await safeGet(url);
  if (!response?.ok) return null;
  const html = response.text;
  const heading = tag(html, "h1") || tag(html, "title");
  const text = stripHtml(html);
  const status = ILCOR_STATUS.find(([pattern]) => pattern.test(text))?.[1] || null;
  return {
    source_name: "ILCOR CoSTR",
    source_url: url,
    title_original: (heading || titleFromSlug(url)).slice(0, 500),
    source_status: status,
    published_date: null, // o site do ILCOR não informa datas nas páginas
    updated_date: null,
    pub_types: [],
    raw_text: text.slice(0, 5000),
    analysis_basis: "pagina_da_fonte",
  };
}
