// Fluxo do Radar de Evidências: coletar -> deduplicar -> triagem -> análise -> RASCUNHO.
// Nada é publicado aqui: o banco (supabase/46) impede a automação de aprovar ou publicar.
//
// Limite da hospedagem: cada chamada tem no máximo 60 s. Por isso o trabalho é uma fila:
//  * startRun   coleta, deduplica e faz a triagem; analisa o que couber no tempo;
//  * processQueue analisa os itens que sobraram ("pending_analysis"), poucos por chamada.
// A trava é o próprio banco: só pode existir UMA execução "running" (índice único) e cada item é "reservado"
// com um UPDATE condicional antes de ser analisado.
import { sb } from "../checkout.js";
import { sendTelegram } from "../notify.js";
import { AiBusy, AiNotConfigured, analyze, triage } from "./ai.js";
import { collectNaemsp, collectPubmed, fetchIlcorDocument, fetchPubmedRecords, listIlcorDocuments, titleFromSlug } from "./sources.js";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const RUN_BUDGET_MS = 52 * 1000;
const STALE_RUN_MS = 10 * MIN;
const STALE_CLAIM_MS = 10 * MIN;
const MANUAL_COOLDOWN_MS = 5 * MIN;
const CRON_MIN_GAP_MS = 5 * DAY;
const MAX_ATTEMPTS = 3;
const ANALYSIS_START_MARGIN_MS = 38 * 1000; // só começa uma análise se sobrar tempo para ela terminar

const nowIso = () => new Date().toISOString();
const inList = (values) => `(${values.map((v) => `"${String(v).replace(/"/g, "")}"`).join(",")})`;

export class RadarBusy extends Error {}

// ---------------------------------------------------------------- utilidades

function buildReferences(item) {
  const refs = [];
  if (item.pmid) refs.push({ label: "PubMed", url: `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`, pmid: item.pmid });
  if (item.doi) refs.push({ label: "DOI", url: `https://doi.org/${item.doi}`, doi: item.doi });
  if (item.source_url && !refs.some((r) => r.url === item.source_url)) refs.push({ label: item.source_name, url: item.source_url });
  return refs;
}

function pubTypeFromPubmed(types = []) {
  const t = types.map((x) => x.toLowerCase());
  if (t.some((x) => x.includes("preprint"))) return "preprint";
  if (t.some((x) => x.includes("guideline") || x.includes("consensus"))) return "diretriz_final";
  if (t.some((x) => x.includes("systematic review") || x.includes("meta-analysis") || x === "review")) return "revisao";
  if (t.some((x) => x.includes("editorial") || x.includes("comment") || x.includes("letter"))) return "opiniao";
  if (t.some((x) => x.includes("trial") || x.includes("observational") || x.includes("study"))) return "estudo_original";
  return null;
}

async function existingKeys({ pmids, dois, urls }) {
  const found = { pmids: new Set(), dois: new Set(), urls: new Set() };
  const queries = [];
  if (pmids.length) queries.push(sb(`radar_items?pmid=in.${inList(pmids)}&select=pmid`).then((rows) => rows.forEach((r) => found.pmids.add(r.pmid))));
  if (dois.length) queries.push(sb(`radar_items?doi=in.${inList(dois)}&select=doi`).then((rows) => rows.forEach((r) => found.dois.add(String(r.doi).toLowerCase()))));
  if (urls.length) queries.push(sb(`radar_items?source_url=in.${inList(urls)}&select=source_url`).then((rows) => rows.forEach((r) => found.urls.add(r.source_url))));
  await Promise.all(queries);
  return found;
}

// Grava candidatos novos (sem repetir PMID, DOI ou URL). Devolve quantos entraram.
async function insertCandidates(candidates, runId, status = "candidate", discardReason = null) {
  let inserted = 0;
  for (const c of candidates) {
    const row = {
      run_id: runId,
      topic: c.topic || null,
      source_name: c.source_name,
      source_url: c.source_url || null,
      doi: c.doi ? c.doi.toLowerCase() : null,
      pmid: c.pmid || null,
      source_status: c.source_status || null,
      title_original: c.title_original,
      authors: c.authors || null,
      published_date: c.published_date || null,
      updated_date: c.updated_date || null,
      publication_type: pubTypeFromPubmed(c.pub_types),
      analysis_basis: c.analysis_basis || "resumo",
      status,
    };
    try {
      const created = await sb("radar_items", { method: "POST", prefer: "return=representation", body: row });
      const id = created?.[0]?.id;
      if (id) {
        await sb("radar_item_private", { method: "POST", body: { item_id: id, raw_text: c.raw_text || null, discard_reason: discardReason } });
        inserted += 1;
      }
    } catch (error) {
      if (error.status !== 409) console.error("radar insert:", error.message); // 409 = já existia (deduplicação do banco)
    }
  }
  return inserted;
}

async function patchRun(id, fields) {
  await sb(`radar_runs?id=eq.${id}`, { method: "PATCH", body: fields }).catch((error) => console.error("radar run patch:", error.message));
}

// ---------------------------------------------------------------- fila de análise

const TRIAGE_BATCH = 20;
const WEEKLY_LIMIT = 5;

// Avalia os candidatos ainda não triados e move os escolhidos para a fila de análise. Devolve quantos foram escolhidos.
export async function triagePending() {
  const pending = (await sb(`radar_items?status=eq.candidate&select=id,topic,source_name,title_original,publication_type,radar_item_private(raw_text)&order=discovered_at.asc&limit=${TRIAGE_BATCH}`)) || [];
  if (!pending.length) return 0;
  let selected = 0;
  // limite de 5 itens por semana na fila de revisão (somando os lotes): o que já está na fila ou virou rascunho há menos de 7 dias conta
  const inFlow = (await sb("radar_items?status=in.(pending_analysis,analyzing)&select=id"))?.length || 0;
  const recentDrafts = (await sb(`radar_items?status=eq.draft&discovered_at=gte.${new Date(Date.now() - 7 * DAY).toISOString()}&select=id`))?.length || 0;
  const allowance = Math.max(0, WEEKLY_LIMIT - inFlow - recentDrafts);
  if (allowance === 0) {
    const ids = pending.map((p) => p.id);
    await sb(`radar_items?id=in.(${ids.join(",")})`, { method: "PATCH", body: { status: "discarded" } });
    await sb("radar_item_private?on_conflict=item_id", { method: "POST", prefer: "resolution=merge-duplicates", body: ids.map((id) => ({ item_id: id, discard_reason: `Limite de ${WEEKLY_LIMIT} itens por semana já atingido.` })) });
    return 0;
  }
  const decisions = await triage(pending.map((p) => ({ ref: p.id, title_original: p.title_original, source_name: p.source_name, topic: p.topic, pub_types: [], raw_text: p.radar_item_private?.raw_text || "" })), { max: allowance });
  for (const p of pending) {
    const d = decisions.get(p.id);
    if (!d) continue; // a IA não respondeu sobre este: continua candidato para a próxima triagem
    if (d.select) {
      selected += 1;
      await sb(`radar_items?id=eq.${p.id}`, { method: "PATCH", body: { status: "pending_analysis", topic: d.topic, population: d.population, publication_type: d.publication_type } });
      await sb("radar_item_private?on_conflict=item_id", { method: "POST", prefer: "resolution=merge-duplicates", body: { item_id: p.id, relevance_note: d.reason } });
    } else {
      await sb(`radar_items?id=eq.${p.id}`, { method: "PATCH", body: { status: "discarded", topic: d.topic, population: d.population } });
      await sb("radar_item_private?on_conflict=item_id", { method: "POST", prefer: "resolution=merge-duplicates", body: { item_id: p.id, discard_reason: d.reason || "Não relevante nesta triagem." } });
    }
  }
  return selected;
}

async function releaseStaleClaims() {
  await sb(`radar_items?status=eq.analyzing&claimed_at=lt.${new Date(Date.now() - STALE_CLAIM_MS).toISOString()}`, {
    method: "PATCH",
    body: { status: "pending_analysis", claimed_at: null },
  }).catch(() => null);
}

async function analyzeOne(itemRow) {
  const claimed = await sb(`radar_items?id=eq.${itemRow.id}&status=eq.pending_analysis`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { status: "analyzing", claimed_at: nowIso() },
  });
  if (!claimed?.length) return false; // outra chamada pegou este item

  const item = claimed[0];
  try {
    const priv = (await sb(`radar_item_private?item_id=eq.${item.id}&select=raw_text`))?.[0];
    const result = await analyze({
      ref: item.id,
      title_original: item.title_original,
      source_name: item.source_name,
      authors: item.authors,
      published_date: item.published_date,
      source_status: item.source_status,
      analysis_basis: item.analysis_basis,
      raw_text: priv?.raw_text || "",
    });
    await sb(`radar_items?id=eq.${item.id}`, {
      method: "PATCH",
      body: {
        title_pt: result.title_pt,
        study_design: result.study_design,
        publication_type: result.publication_type || item.publication_type,
        population: result.population || item.population,
        summary_pt: result.summary_pt,
        main_finding: result.main_finding,
        what_changed: result.what_changed,
        evidence_strength: result.evidence_strength,
        limitations: result.limitations,
        applicability_br: result.applicability_br,
        official_grade: result.official_grade,
        "references": buildReferences(item),
        status: "draft",
        claimed_at: null,
      },
    });
    await sb("radar_item_private?on_conflict=item_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: { item_id: item.id, course_updates: result.course_updates, editorial_action: result.editorial_action, last_error: null },
    });
    if (item.run_id) {
      const run = (await sb(`radar_runs?id=eq.${item.run_id}&select=analyzed`))?.[0];
      if (run) await patchRun(item.run_id, { analyzed: (run.analyzed || 0) + 1 });
    }
    return true;
  } catch (error) {
    const attempts = (item.error_count || 0) + 1;
    const notItsFault = error instanceof AiNotConfigured || error instanceof AiBusy; // chave ausente ou limite de uso: não conta como falha do item
    const giveUp = attempts >= MAX_ATTEMPTS && !notItsFault;
    await sb(`radar_items?id=eq.${item.id}`, {
      method: "PATCH",
      body: { status: giveUp ? "discarded" : "pending_analysis", claimed_at: null, error_count: notItsFault ? item.error_count || 0 : attempts },
    }).catch(() => null);
    await sb("radar_item_private?on_conflict=item_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: { item_id: item.id, last_error: String(error.message).slice(0, 400), ...(giveUp ? { discard_reason: `Falhou ${MAX_ATTEMPTS} vezes: ${String(error.message).slice(0, 200)}` } : {}) },
    }).catch(() => null);
    if (notItsFault) throw error;
    console.error("radar analyze:", error.message);
    return false;
  }
}

// Analisa itens pendentes enquanto houver tempo (e até maxItems). Devolve quantos restam na fila.
export async function processQueue({ deadline = Date.now() + RUN_BUDGET_MS, maxItems = 5 } = {}) {
  await releaseStaleClaims();
  let processed = 0;
  let aiError = null;
  const waiting = (await sb("radar_items?status=eq.candidate&select=id&limit=1"))?.length;
  if (waiting) {
    try {
      await triagePending();
    } catch (error) {
      aiError = error.message;
    }
  }
  while (!aiError && processed < maxItems && deadline - Date.now() > ANALYSIS_START_MARGIN_MS) {
    const next = (await sb("radar_items?status=eq.pending_analysis&select=id&order=discovered_at.asc&limit=1"))?.[0];
    if (!next) break;
    try {
      if (await analyzeOne(next)) processed += 1;
      else break; // item reservado por outra chamada ou falhou: não insiste, a fila volta na próxima chamada
    } catch (error) {
      aiError = error.message;
      break;
    }
  }
  const remaining = (await sb("radar_items?status=in.(candidate,pending_analysis,analyzing)&select=id"))?.length || 0;
  if (processed > 0 && remaining === 0) {
    const drafts = (await sb("radar_items?status=eq.draft&select=id"))?.length || 0;
    await sendTelegram(`Radar de Evidências: análise concluída\n${drafts} rascunho(s) esperando a sua revisão em Conteúdos e materiais > Radar.`).catch(() => null);
  }
  return { processed, remaining, error: aiError };
}

// ---------------------------------------------------------------- execução completa

async function acquireRun(trigger) {
  await sb(`radar_runs?status=eq.running&started_at=lt.${new Date(Date.now() - STALE_RUN_MS).toISOString()}`, {
    method: "PATCH",
    body: { status: "error", finished_at: nowIso(), error: "Interrompida (passou do tempo limite)." },
  }).catch(() => null);

  if (trigger === "manual") {
    const last = (await sb("radar_runs?select=started_at&order=started_at.desc&limit=1"))?.[0];
    if (last && Date.now() - new Date(last.started_at).getTime() < MANUAL_COOLDOWN_MS) {
      throw new RadarBusy("Uma coleta foi iniciada há menos de 5 minutos. Aguarde um pouco antes de buscar de novo.");
    }
  }
  try {
    const created = await sb("radar_runs", { method: "POST", prefer: "return=representation", body: { trigger } });
    return created[0];
  } catch (error) {
    if (error.status === 409) throw new RadarBusy("Já existe uma coleta em andamento.");
    throw error;
  }
}

export async function startRun({ trigger }) {
  const settings = (await sb("radar_settings?id=eq.1&select=*&limit=1").catch(() => null))?.[0];
  if (!settings) return { skipped: true, reason: "supabase/46_radar_evidencias.sql ainda não foi executado" };
  if (trigger === "cron") {
    if (!settings.enabled) return { skipped: true, reason: "agendamento desligado no painel" };
    const last = (await sb("radar_runs?trigger=eq.cron&select=started_at&order=started_at.desc&limit=1"))?.[0];
    if (last && Date.now() - new Date(last.started_at).getTime() < CRON_MIN_GAP_MS) return { skipped: true, reason: "já houve coleta agendada nos últimos 5 dias" };
  }

  const run = await acquireRun(trigger);
  const startedAt = Date.now();
  const deadline = startedAt + RUN_BUDGET_MS;
  const since = settings.last_success_at ? new Date(new Date(settings.last_success_at).getTime() - 2 * DAY) : new Date(startedAt - (settings.first_window_days || 30) * DAY);
  await patchRun(run.id, { since_date: since.toISOString().slice(0, 10) });

  const problems = [];
  let found = 0;
  let newItems = 0;
  let primaryOk = false;

  try {
    // 1) PubMed (fonte principal)
    try {
      const { ids, topicByPmid } = await collectPubmed(since);
      found += ids.length;
      const known = await existingKeys({ pmids: ids, dois: [], urls: [] });
      const fresh = ids.filter((id) => !known.pmids.has(id)).slice(0, 40);
      const records = fresh.length ? await fetchPubmedRecords(fresh) : [];
      const withDoi = records.filter((r) => r.doi);
      const dup = await existingKeys({ pmids: [], dois: withDoi.map((r) => r.doi.toLowerCase()), urls: [] });
      const toInsert = records
        .filter((r) => !(r.doi && dup.dois.has(r.doi.toLowerCase())))
        .filter((r) => r.raw_text.length >= 200 || (r.pub_types || []).some((t) => /guideline|consensus/i.test(t)))
        .map((r) => ({ ...r, topic: topicByPmid.get(r.pmid) }));
      newItems += await insertCandidates(toInsert, run.id);
      // sem resumo útil: registra como descartado para nunca mais voltar à fila
      const noAbstract = records.filter((r) => r.raw_text.length < 200 && !(r.pub_types || []).some((t) => /guideline|consensus/i.test(t)) && !(r.doi && dup.dois.has(r.doi.toLowerCase())));
      await insertCandidates(noAbstract.map((r) => ({ ...r, topic: topicByPmid.get(r.pmid) })), run.id, "discarded", "Sem resumo disponível para análise fundamentada.");
      primaryOk = true;
    } catch (error) {
      problems.push(`PubMed: ${error.message}`);
    }

    // 2) NAEMSP (feed RSS)
    try {
      const items = await collectNaemsp(since);
      found += items.length;
      const known = await existingKeys({ pmids: [], dois: [], urls: items.map((i) => i.source_url) });
      newItems += await insertCandidates(items.filter((i) => !known.urls.has(i.source_url)).slice(0, 10), run.id);
    } catch (error) {
      problems.push(`NAEMSP: ${error.message}`);
    }

    // 3) ILCOR CoSTR (sem feed e sem datas: guarda o que existe e avisa o que é novo ou mudou de situação)
    try {
      const urls = await listIlcorDocuments();
      found += urls.length;
      const known = (await sb("radar_items?source_name=eq.ILCOR%20CoSTR&select=id,source_url,source_status,status"))?.filter(Boolean) || [];
      const knownUrls = new Set(known.map((k) => k.source_url));
      const fresh = urls.filter((u) => !knownUrls.has(u));
      if (known.length === 0) {
        // primeira vez: o site não informa datas, então o que já existe vira "linha de base" e só o futuro entra na análise
        await insertCandidates(urls.map((u) => ({ source_name: "ILCOR CoSTR", source_url: u, title_original: titleFromSlug(u), pub_types: [], raw_text: "" })), run.id, "discarded", "Linha de base: já existia quando o monitoramento do ILCOR começou.");
      } else {
        const details = [];
        for (const url of fresh.slice(0, 4)) {
          const doc = await fetchIlcorDocument(url);
          if (doc) details.push(doc);
        }
        newItems += await insertCandidates(details, run.id);
        // documento que estava como rascunho para consulta e mudou de situação: aviso numa versão pendente
        for (const old of known.filter((k) => /consulta/i.test(k.source_status || "")).slice(0, 3)) {
          const doc = await fetchIlcorDocument(old.source_url);
          if (doc?.source_status && doc.source_status !== old.source_status) {
            await sb("radar_item_private?on_conflict=item_id", {
              method: "POST",
              prefer: "resolution=merge-duplicates",
              body: { item_id: old.id, pending_version: { kind: "source_update", detected_at: nowIso(), from: old.source_status, to: doc.source_status } },
            });
            await sb(`radar_items?id=eq.${old.id}`, { method: "PATCH", body: { source_status: doc.source_status } }).catch(() => null);
          }
        }
      }
    } catch (error) {
      problems.push(`ILCOR: ${error.message}`);
    }

    if (!primaryOk) throw new Error(problems.join(" | ") || "Falha na coleta.");

    // 4) Triagem. Se a IA estiver ocupada ou sem chave, a coleta continua valendo: os candidatos ficam guardados e a
    //    triagem é retomada sozinha (chamada diária, botão "Continuar análise" ou próxima coleta).
    let selected = 0;
    let aiProblem = null;
    try {
      selected = await triagePending();
    } catch (error) {
      aiProblem = error.message;
      problems.push(`IA: ${error.message}`);
    }
    await sb("radar_settings?id=eq.1", { method: "PATCH", body: { last_success_at: new Date(startedAt).toISOString(), updated_at: nowIso() } });
    await patchRun(run.id, { found, new_items: newItems, selected });

    // 5) Análise do que couber no tempo; o resto segue na fila
    const hasQueue = selected > 0 || (await sb("radar_items?status=in.(candidate,pending_analysis)&select=id&limit=1"))?.length;
    // só tenta analisar agora se a triagem funcionou; com a IA ocupada, a fila espera pelas próximas chamadas
    const queue = hasQueue && !aiProblem ? await processQueue({ deadline, maxItems: 5 }) : { processed: 0, remaining: (await sb("radar_items?status=in.(candidate,pending_analysis,analyzing)&select=id"))?.length || 0, error: aiProblem };
    const remaining = queue.remaining;
    const status = selected === 0 && remaining === 0 ? "no_news" : remaining > 0 ? "partial" : "ok";
    const message =
      status === "no_news"
        ? `Nenhuma novidade relevante (${found} encontrada(s), ${newItems} nova(s) triada(s)).`
        : remaining > 0
        ? `${selected} selecionado(s); ${remaining} aguardando triagem/análise (continua sozinho nos próximos dias ou pelo botão "Continuar análise").`
        : `${selected} selecionado(s) e analisado(s): rascunhos prontos para revisão.`;
    await patchRun(run.id, { status, finished_at: nowIso(), found, new_items: newItems, selected, message: [message, ...problems].join(" | "), error: queue.error || null });
    if (status !== "no_news" && remaining > 0) {
      await sendTelegram(`Radar de Evidências: coleta feita\n${selected} item(ns) selecionado(s), ${remaining} ainda na fila de análise. Abra Conteúdos e materiais > Radar para acompanhar.`).catch(() => null);
    }
    return { ok: true, status, found, newItems, selected, remaining, problems };
  } catch (error) {
    console.error("radar run error:", error.message);
    await patchRun(run.id, { status: "error", finished_at: nowIso(), found, new_items: newItems, error: String(error.message).slice(0, 500), message: problems.join(" | ") || null });
    await sendTelegram(`Radar de Evidências: falha na coleta\n${String(error.message).slice(0, 300)}`).catch(() => null);
    return { ok: false, error: error.message, problems };
  }
}

// Nova análise de um item que já existe: nunca altera o conteúdo aprovado, só grava uma versão pendente de revisão.
export async function reanalyze(itemId) {
  const item = (await sb(`radar_items?id=eq.${encodeURIComponent(itemId)}&select=*,radar_item_private(raw_text)`))?.[0];
  if (!item) throw new Error("Item não encontrado.");
  const result = await analyze({
    ref: item.id,
    title_original: item.title_original,
    source_name: item.source_name,
    authors: item.authors,
    published_date: item.published_date,
    source_status: item.source_status,
    analysis_basis: item.analysis_basis,
    raw_text: item.radar_item_private?.raw_text || "",
  });
  await sb("radar_item_private?on_conflict=item_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: { item_id: item.id, pending_version: { kind: "reanalysis", created_at: nowIso(), analysis: result } },
  });
  return { ok: true };
}
