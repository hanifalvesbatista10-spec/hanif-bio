// Rótulos e utilidades do Radar de Evidências (usados no painel e na página pública) e cliente das ações
// do servidor (/api/cron-recover-sales?job=radar). O navegador nunca recebe chave de IA nem de serviço.
import { supabase } from "./supabase";

export const TOPIC_LABELS = {
  rcp_dea: "RCP e DEA",
  trauma_hemorragia: "Trauma, hemorragia e choque",
  pediatria_neonatal: "Pediatria e neonatal",
  coluna: "Restrição de movimento da coluna",
};
export const POPULATION_LABELS = { adulto: "Adulto", pediatrico: "Pediátrico", neonatal: "Neonatal", misto: "Adulto e pediátrico", nao_se_aplica: "Não se aplica" };
export const TYPE_LABELS = {
  diretriz_final: "Diretriz final",
  consulta_publica: "Rascunho em consulta pública",
  revisao: "Revisão",
  estudo_original: "Estudo original",
  preprint: "Preprint (não revisado por pares)",
  opiniao: "Opinião / editorial",
  outro: "Outro",
};
export const ACTION_LABELS = { atualizar_agora: "Atualizar agora", acompanhar: "Acompanhar antes de mudar", divulgar: "Apenas divulgar" };
export const STATUS_LABELS = {
  candidate: "Candidato",
  pending_analysis: "Na fila de análise",
  analyzing: "Analisando",
  draft: "Rascunho",
  approved: "Aprovado",
  published: "Publicado",
  rejected: "Rejeitado",
  archived: "Arquivado",
  discarded: "Descartado na triagem",
};
export const BASIS_LABELS = { resumo: "Análise baseada no resumo", pagina_da_fonte: "Análise baseada na página da fonte" };

export const formatDate = (value) => (value ? new Intl.DateTimeFormat("pt-BR").format(new Date(String(value).length === 10 ? `${value}T12:00:00` : value)) : "—");

// Só links http(s) viram link clicável.
export const safeUrl = (value) => (/^https?:\/\//i.test(String(value || "")) ? String(value) : null);

export async function radarAction(action, params = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { error: "Sua sessão expirou. Entre novamente." };
  const query = new URLSearchParams({ job: "radar", action, ...params });
  let response;
  try {
    response = await fetch(`/api/cron-recover-sales?${query}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { error: "Sem conexão ou a operação demorou demais. Tente novamente." };
  }
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json().catch(() => null) : null;
  if (!payload) return { error: "A coleta só funciona no site publicado (Vercel), não no ambiente de testes local." };
  if (!response.ok) return { error: payload.message || "Não foi possível concluir a operação." };
  return payload;
}
