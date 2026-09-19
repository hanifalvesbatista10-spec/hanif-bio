import { useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import {
  buildZip,
  certificateFileName,
  downloadBlob,
  renderPdf,
  slug,
  verifyUrl,
} from "../../services/certificates";

export default function IssuedPanel({ certificates, templates, onChange, notify }) {
  const [query, setQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [progress, setProgress] = useState(null);

  const templateById = useMemo(() => Object.fromEntries(templates.map((template) => [template.id, template])), [templates]);
  const batches = useMemo(() => [...new Set(certificates.map((c) => c.batch_label).filter(Boolean))], [certificates]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return certificates.filter((c) => {
      if (templateFilter && c.template_id !== templateFilter) return false;
      if (batchFilter && c.batch_label !== batchFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (!term) return true;
      return [c.recipient_name, c.recipient_email, c.code, c.batch_label].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [certificates, query, templateFilter, batchFilter, statusFilter]);

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));

  const download = async (certificate) => {
    const template = templateById[certificate.template_id];
    if (!template) return notify("error", "O modelo deste certificado não foi encontrado.");
    setBusyId(certificate.id);
    try {
      downloadBlob(await renderPdf({ template, certificate }), certificateFileName(certificate.recipient_name, certificate.code));
    } catch (error) {
      notify("error", `Não foi possível gerar o PDF: ${error.message}`);
    }
    setBusyId(null);
  };

  const downloadMany = async (list, label) => {
    const items = list.filter((c) => templateById[c.template_id]).map((certificate) => ({ template: templateById[certificate.template_id], certificate }));
    if (items.length === 0) return;
    setProgress({ done: 0, total: items.length });
    try {
      const zip = await buildZip({ items, onProgress: (done, total) => setProgress({ done, total }) });
      downloadBlob(zip, `certificados-${slug(label)}.zip`);
    } catch (error) {
      notify("error", `Não foi possível gerar o ZIP: ${error.message}`);
    }
    setProgress(null);
  };

  const copyLink = async (certificate) => {
    try {
      await navigator.clipboard.writeText(verifyUrl(certificate.code));
      notify("success", "Link de verificação copiado.");
    } catch {
      notify("error", `Copie manualmente: ${verifyUrl(certificate.code)}`);
    }
  };

  const setStatus = async (certificate, status) => {
    setBusyId(certificate.id);
    const { error } = await supabase.from("certificates").update({ status }).eq("id", certificate.id);
    if (error) notify("error", `Erro: ${error.message}`);
    else {
      onChange(certificates.map((c) => (c.id === certificate.id ? { ...c, status } : c)));
      notify("success", status === "revoked" ? "Certificado revogado: a verificação pública passa a mostrar “revogado”." : "Certificado reativado.");
    }
    setBusyId(null);
  };

  const remove = async (certificate) => {
    if (!window.confirm(`Excluir definitivamente o certificado de ${certificate.recipient_name}?\n\nO código ${certificate.code} deixará de existir. Para apenas invalidar, use “Revogar”.`)) return;
    setBusyId(certificate.id);
    const { error } = await supabase.from("certificates").delete().eq("id", certificate.id);
    if (error) notify("error", `Erro ao excluir: ${error.message}`);
    else {
      onChange(certificates.filter((c) => c.id !== certificate.id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(certificate.id);
        return next;
      });
      notify("success", "Certificado excluído.");
    }
    setBusyId(null);
  };

  const selectedList = certificates.filter((c) => selected.has(c.id));

  return (
    <div className="cert-issued">
      <div className="cert-filters">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, e-mail, código ou lote..." aria-label="Buscar certificados" />
        <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)} aria-label="Filtrar por modelo">
          <option value="">Todos os modelos</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} aria-label="Filtrar por lote">
          <option value="">Todos os lotes</option>
          {batches.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por situação">
          <option value="">Válidos e revogados</option>
          <option value="valid">Só válidos</option>
          <option value="revoked">Só revogados</option>
        </select>
      </div>

      <div className="cert-bulkbar">
        <span><strong>{filtered.length}</strong> certificado(s){selected.size > 0 && <> · {selected.size} selecionado(s)</>}</span>
        <div className="cert-row-actions">
          <button type="button" className="adm-action" disabled={selected.size === 0 || Boolean(progress)} onClick={() => downloadMany(selectedList, "selecionados")}>Baixar selecionados (ZIP)</button>
          <button type="button" className="adm-action" disabled={filtered.length === 0 || Boolean(progress)} onClick={() => downloadMany(filtered, batchFilter || "filtrados")}>Baixar todos os filtrados (ZIP)</button>
        </div>
      </div>

      {progress && (
        <div className="adm-progress" role="status">
          <div className="adm-progress-bar"><span style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }} /></div>
          <small>Gerando PDFs: {progress.done}/{progress.total}</small>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table cert-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos" /></th>
              <th>Nome</th><th>Modelo</th><th>Lote</th><th>Código</th><th>Emitido em</th><th>Situação</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="8" className="adm-table-empty">{certificates.length === 0 ? "Nenhum certificado emitido ainda." : "Nenhum certificado encontrado."}</td></tr>
            ) : filtered.map((certificate) => (
              <tr key={certificate.id} className={certificate.status === "revoked" ? "is-revoked" : ""}>
                <td><input type="checkbox" checked={selected.has(certificate.id)} onChange={() => toggle(certificate.id)} aria-label={`Selecionar ${certificate.recipient_name}`} /></td>
                <td><strong>{certificate.recipient_name}</strong><small>{certificate.recipient_email || "sem e-mail"}</small></td>
                <td>{templateById[certificate.template_id]?.name || "—"}</td>
                <td>{certificate.batch_label || "—"}</td>
                <td><code>{certificate.code}</code></td>
                <td>{new Date(certificate.issued_at).toLocaleDateString("pt-BR")}</td>
                <td><span className={`status-badge ${certificate.status === "valid" ? "published" : "hidden"}`}>{certificate.status === "valid" ? "Válido" : "Revogado"}</span></td>
                <td>
                  <div className="cert-row-actions">
                    <button type="button" className="adm-action is-primary" disabled={busyId === certificate.id} onClick={() => download(certificate)}>Baixar PDF</button>
                    <button type="button" className="adm-action" onClick={() => copyLink(certificate)}>Copiar link</button>
                    <button type="button" className="adm-action" disabled={busyId === certificate.id} onClick={() => setStatus(certificate, certificate.status === "valid" ? "revoked" : "valid")}>{certificate.status === "valid" ? "Revogar" : "Reativar"}</button>
                    <button type="button" className="adm-action is-danger" disabled={busyId === certificate.id} onClick={() => remove(certificate)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
