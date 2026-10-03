import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { formatDate } from "../../services/radar";

// Planilha: texto vindo do visitante nunca pode virar fórmula (=, +, -, @) ao abrir no Excel ou Google Planilhas.
const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const formatPhone = (digits) => {
  const d = String(digits || "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return d;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState({ type: "", text: "" });

  const load = async () => {
    const { data, error } = await supabase
      .from("radar_leads")
      .select("id,name,email,whatsapp,created_at,consent_at,radar_item_id,radar_items(title_pt,title_original)")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) setMissing(true);
    else setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () =>
      leads.filter((lead) => {
        const day = lead.created_at.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        if (text && !`${lead.name} ${lead.email} ${lead.whatsapp}`.toLowerCase().includes(text.toLowerCase())) return false;
        return true;
      }),
    [leads, text, from, to]
  );

  const exportCsv = () => {
    const header = ["Nome", "WhatsApp", "E-mail", "Cadastrado em", "Consentimento em", "Análise de origem"];
    const rows = visible.map((lead) => [
      lead.name,
      lead.whatsapp,
      lead.email,
      new Date(lead.created_at).toLocaleString("pt-BR"),
      new Date(lead.consent_at).toLocaleString("pt-BR"),
      lead.radar_items?.title_pt || lead.radar_items?.title_original || "",
    ]);
    const csv = `﻿${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-radar-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNote({ type: "ok", text: `${rows.length} lead(s) exportado(s).` });
  };

  const remove = async (lead) => {
    if (!window.confirm(`Excluir o lead "${lead.name}"? Isso atende um pedido de remoção de dados e não pode ser desfeito.`)) return;
    const { error } = await supabase.from("radar_leads").delete().eq("id", lead.id);
    if (error) return setNote({ type: "error", text: `Não foi possível excluir: ${error.message}` });
    setNote({ type: "ok", text: "Lead excluído." });
    load();
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">
          O banco ainda não tem os leads do Radar. Execute <strong>supabase/48_radar_leads.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>DIVULGAÇÃO</span>
          <h2>Leads do Radar</h2>
        </div>
        <button type="button" className="admin-button primary" onClick={exportCsv} disabled={visible.length === 0}>Exportar planilha (CSV)</button>
      </div>

      <p className="adm-hint">
        Pessoas que deixaram nome, WhatsApp e e-mail para ler as análises do Radar de Evidências. Cada novo lead também chega no seu Telegram.
        O link da comunidade que aparece no fim da leitura é configurado em <strong>Conteúdo do site</strong>.
      </p>

      {note.text && <div className={`admin-alert ${note.type === "error" ? "error" : ""}`} role="status">{note.text}</div>}

      <div className="cp-form">
        <div className="cp-grid">
          <label>Buscar por nome, e-mail ou WhatsApp<input value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label>Cadastrados de<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>até<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty">{leads.length === 0 ? "Nenhum lead ainda." : "Nenhum lead com esse filtro."}</div>
      ) : (
        <>
          <p className="adm-hint">{visible.length} de {leads.length} lead(s).</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>CADASTRO</th><th>NOME</th><th>WHATSAPP</th><th>E-MAIL</th><th>ANÁLISE</th><th>AÇÕES</th></tr></thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id}>
                    <td>{formatDate(lead.created_at)}</td>
                    <td>{lead.name}</td>
                    <td><a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer">{formatPhone(lead.whatsapp)}</a></td>
                    <td><a href={`mailto:${lead.email}`}>{lead.email}</a></td>
                    <td>{lead.radar_items?.title_pt || lead.radar_items?.title_original || "—"}</td>
                    <td><button type="button" className="admin-button adm-ghost" onClick={() => remove(lead)}>Excluir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
