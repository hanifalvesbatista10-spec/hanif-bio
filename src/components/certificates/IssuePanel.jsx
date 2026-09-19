import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { uploadCertificateImage } from "../../services/certificateStorage";
import {
  BATCH_LIMIT,
  buildMergedPdf,
  buildZip,
  certificateFileName,
  downloadBlob,
  formatDatePt,
  formatValue,
  getPages,
  humanize,
  parsePastedTable,
  renderPdf,
  sampleValues,
  slug,
  templateVariables,
  usesPhoto,
  validEmail,
  verifyUrl,
} from "../../services/certificates";
import CertificateCanvas from "./CertificateCanvas";

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Valores iniciais: padrão do modelo; "data" ganha a data de hoje se não houver padrão.
function initialValues(template, variables) {
  const values = {};
  variables.forEach((key) => {
    values[key] = template.defaults?.[key] || (key === "data" ? formatDatePt() : "");
  });
  return values;
}

export default function IssuePanel({ templates, initialTemplateId, onIssued }) {
  const [templateId, setTemplateId] = useState(initialTemplateId || templates[0]?.id || "");
  const [mode, setMode] = useState("single");
  const template = templates.find((item) => item.id === templateId) || null;
  const variables = useMemo(() => (template ? templateVariables(template) : []), [template]);
  const pages = useMemo(() => (template ? getPages(template) : []), [template]);
  const hasPhoto = useMemo(() => (template ? usesPhoto(template) : false), [template]);

  const [values, setValues] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [paste, setPaste] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [includedPages, setIncludedPages] = useState([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { label, done, total }
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [issued, setIssued] = useState(null); // último resultado: { list, kind }
  const fileRef = useRef(null);

  useEffect(() => {
    if (template) {
      setValues(initialValues(template, variables));
      setIncludedPages(getPages(template).map((page) => page.id));
    }
    setPreviewPage(0);
    setIssued(null);
    setPhotoFile(null);
    setPhotoPreview("");
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const knownColumns = useMemo(() => (hasPhoto ? [...variables, "foto"] : variables), [variables, hasPhoto]);
  const parsed = useMemo(() => parsePastedTable(paste, knownColumns), [paste, knownColumns]);
  const rows = useMemo(
    () =>
      parsed.rows.map((row, index) => {
        const problems = [];
        if (!row.nome || row.nome.trim().length < 2) problems.push("sem nome");
        if (row.email && !validEmail(row.email)) problems.push("e-mail inválido");
        return { ...row, line: index + 1, problems };
      }),
    [parsed]
  );
  const validRows = rows.filter((row) => row.problems.length === 0);
  const duplicateNames = useMemo(() => {
    const seen = new Set();
    const dups = new Set();
    validRows.forEach((row) => {
      const key = slug(row.nome);
      if (seen.has(key)) dups.add(key);
      seen.add(key);
    });
    return dups;
  }, [validRows]);

  if (templates.length === 0) {
    return (
      <div className="admin-empty">
        <strong>Para emitir, primeiro cadastre o plano de fundo.</strong>
        <br />
        1) Envie a arte pronta do certificado · 2) confira os textos que o sistema coloca por cima · 3) emita um ou vários de uma vez.
        <br />
        <Link className="admin-button primary" style={{ marginTop: 14 }} to="/admin/certificados/modelo/novo">Enviar meu plano de fundo</Link>
      </div>
    );
  }

  const partialPages = includedPages.length !== pages.length;
  const pagesData = partialPages ? { __pages: includedPages } : {};
  const formattedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, formatValue(key, value)]));
  const previewValues = { ...sampleValues(template), ...formattedValues, nome: name.trim() || sampleValues(template).nome, foto: photoPreview || "" };
  const currentPreview = pages[previewPage] || pages[0];

  const cleanValues = () => {
    const out = {};
    variables.forEach((key) => {
      out[key] = formatValue(key, values[key]);
    });
    return out;
  };

  const insertRows = async (records) => {
    const inserted = [];
    for (let i = 0; i < records.length; i += 100) {
      const { data, error } = await supabase.from("certificates").insert(records.slice(i, i + 100)).select("*");
      if (error) throw error;
      inserted.push(...data);
      setProgress({ label: "Registrando certificados", done: inserted.length, total: records.length });
    }
    return inserted;
  };

  const togglePage = (id) =>
    setIncludedPages((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const onPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("error", "Escolha uma imagem (JPG ou PNG).");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const issueSingle = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) return notify("error", "Informe o nome de quem vai receber.");
    if (!validEmail(email.trim())) return notify("error", "O e-mail informado não parece válido.");
    if (includedPages.length === 0) return notify("error", "Marque ao menos uma página para emitir.");
    setBusy(true);
    setMessage("");
    try {
      const data = { ...cleanValues(), ...pagesData };
      if (hasPhoto && photoFile) {
        setProgress({ label: "Enviando foto", done: 0, total: 1 });
        data.foto = await uploadCertificateImage(photoFile, "photos");
      }
      const [row] = await insertRows([
        {
          template_id: template.id,
          recipient_name: name.trim(),
          recipient_email: email.trim().toLowerCase() || null,
          data,
          batch_label: batchLabel.trim() || null,
        },
      ]);
      setProgress({ label: "Gerando PDF", done: 0, total: 1 });
      const blob = await renderPdf({ template, certificate: row });
      downloadBlob(blob, certificateFileName(row.recipient_name, row.code));
      setIssued({ kind: "single", list: [row] });
      notify("success", `Certificado de ${row.recipient_name} emitido. O PDF foi baixado.`);
      setName("");
      setEmail("");
      setPhotoFile(null);
      setPhotoPreview("");
      onIssued?.();
    } catch (error) {
      notify("error", error.message?.includes("certificate") && error.message.includes("exist")
        ? "O banco ainda não tem as tabelas de certificados. Execute supabase/16_certificados.sql."
        : `Não foi possível emitir: ${error.message}`);
    }
    setProgress(null);
    setBusy(false);
  };

  const issueBulk = async () => {
    if (validRows.length === 0) return notify("error", "Cole a lista de nomes primeiro.");
    if (validRows.length > BATCH_LIMIT) return notify("error", `Emita no máximo ${BATCH_LIMIT} certificados por vez. Divida a lista.`);
    if (includedPages.length === 0) return notify("error", "Marque ao menos uma página para emitir.");
    if (rows.length !== validRows.length && !window.confirm(`${rows.length - validRows.length} linha(s) com problema serão ignoradas. Continuar com ${validRows.length}?`)) return;
    setBusy(true);
    setMessage("");
    const label = batchLabel.trim() || `Lote ${formatDatePt()} (${validRows.length})`;
    try {
      const base = cleanValues();
      const records = validRows.map((row) => {
        const data = { ...base, ...pagesData };
        variables.forEach((key) => {
          if (row[key]) data[key] = formatValue(key, row[key]);
        });
        if (hasPhoto && row.foto) data.foto = row.foto;
        return {
          template_id: template.id,
          recipient_name: row.nome.trim(),
          recipient_email: row.email ? row.email.trim().toLowerCase() : null,
          data,
          batch_label: label,
        };
      });
      const list = await insertRows(records);
      setIssued({ kind: "bulk", list, label });
      onIssued?.();
      setProgress({ label: "Gerando PDFs", done: 0, total: list.length });
      const zip = await buildZip({
        items: list.map((certificate) => ({ template, certificate })),
        onProgress: (done, total) => setProgress({ label: "Gerando PDFs", done, total }),
      });
      downloadBlob(zip, `certificados-${slug(label)}.zip`);
      notify("success", `${list.length} certificado(s) emitido(s). O arquivo ZIP foi baixado.`);
      setPaste("");
    } catch (error) {
      notify("error", `Não foi possível concluir a emissão em massa: ${error.message}. Os já registrados aparecem em “Emitidos”.`);
    }
    setProgress(null);
    setBusy(false);
  };

  const downloadMerged = async () => {
    if (!issued) return;
    setBusy(true);
    try {
      const blob = await buildMergedPdf({
        items: issued.list.map((certificate) => ({ template, certificate })),
        onProgress: (done, total) => setProgress({ label: "Montando PDF único", done, total }),
      });
      downloadBlob(blob, `certificados-${slug(issued.label || "lote")}.pdf`);
    } catch (error) {
      notify("error", `Não foi possível montar o PDF único: ${error.message}`);
    }
    setProgress(null);
    setBusy(false);
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPaste(await file.text());
  };

  const columnsHint = ["nome", "email", ...knownColumns].join(" ; ");

  const pagePicker = pages.length > 1 && (
    <fieldset className="cert-common">
      <legend>Páginas a incluir em cada PDF</legend>
      {pages.map((page) => (
        <label className="cert-check" key={page.id}>
          <input type="checkbox" checked={includedPages.includes(page.id)} onChange={() => togglePage(page.id)} disabled={busy} />
          {page.name}
        </label>
      ))}
      <small>Desmarque para emitir só uma parte (por exemplo, só a carteirinha).</small>
    </fieldset>
  );

  return (
    <div className="cert-issue">
      <div className="cert-issue-form">
        <label className="cert-field">
          Modelo de certificado
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={busy}>
            {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <div className="adm-segment" role="group" aria-label="Tipo de emissão">
          <button type="button" className={mode === "single" ? "is-active" : ""} aria-pressed={mode === "single"} onClick={() => setMode("single")}>Emitir um</button>
          <button type="button" className={mode === "bulk" ? "is-active" : ""} aria-pressed={mode === "bulk"} onClick={() => setMode("bulk")}>Emissão em massa</button>
        </div>

        {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

        {mode === "single" ? (
          <form className="cert-form" onSubmit={issueSingle}>
            <label className="cert-field">Nome completo *
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome como deve aparecer no certificado" disabled={busy} required />
            </label>
            <label className="cert-field">E-mail (opcional)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aluno@email.com" disabled={busy} />
              <small>Se o aluno tiver conta com este e-mail, o certificado aparece na área de membros dele.</small>
            </label>
            {variables.map((key) => (
              <label className="cert-field" key={key}>{humanize(key)}
                <input value={values[key] || ""} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} disabled={busy} />
              </label>
            ))}
            {hasPhoto && (
              <label className="cert-field">Foto do participante
                <input type="file" accept="image/*" onChange={onPhoto} disabled={busy} />
                <small>{photoFile ? `${photoFile.name} — aparece na pré-visualização.` : "Opcional. Sem foto, a área da foto fica como na arte."}</small>
              </label>
            )}
            {pagePicker}
            <label className="cert-field">Lote / etiqueta (opcional)
              <input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Ex.: Turma 12 — outubro" disabled={busy} />
            </label>
            <button type="submit" className="admin-button primary" disabled={busy}>{busy ? "Emitindo..." : "Emitir e baixar PDF"}</button>
          </form>
        ) : (
          <div className="cert-form">
            <p className="adm-hint">
              Cole a lista direto do Excel ou Google Planilhas (ou envie um CSV). Com cabeçalho: <code>{columnsHint}</code>.
              Sem cabeçalho, uma linha por nome (e e-mail na 2ª coluna, se houver).
              {hasPhoto && " A coluna foto aceita o link (URL) da imagem de cada pessoa."}
            </p>
            {variables.length > 0 && (
              <fieldset className="cert-common">
                <legend>Valores iguais para todos</legend>
                {variables.map((key) => (
                  <label className="cert-field" key={key}>{humanize(key)}
                    <input value={values[key] || ""} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} disabled={busy} />
                  </label>
                ))}
                <small>Uma coluna com o mesmo nome na lista substitui o valor daquela linha (ex.: cpf, rg, tipo_sanguineo).</small>
              </fieldset>
            )}
            {pagePicker}
            <label className="cert-field">Lista de participantes
              <textarea rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"nome\temail\tcpf\nMaria da Silva\tmaria@email.com\t12345678901\nJoão Souza\tjoao@email.com\t98765432100"} disabled={busy} />
            </label>
            <div className="cert-row-actions">
              <button type="button" className="adm-action" onClick={() => fileRef.current?.click()} disabled={busy}>Enviar arquivo CSV</button>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} hidden />
              {paste && <button type="button" className="adm-action" onClick={() => setPaste("")} disabled={busy}>Limpar</button>}
            </div>
            <label className="cert-field">Lote / etiqueta (opcional)
              <input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Ex.: Turma 12 — outubro" disabled={busy} />
            </label>

            {rows.length > 0 && (
              <div className="cert-preview-table" aria-label="Conferência da lista">
                <p className="cert-preview-summary">
                  <strong>{validRows.length}</strong> pronto(s)
                  {rows.length !== validRows.length && <> · <span className="is-bad">{rows.length - validRows.length} com problema</span></>}
                  {duplicateNames.size > 0 && <> · <span className="is-warn">{duplicateNames.size} nome(s) repetido(s)</span></>}
                  {parsed.ignored.length > 0 && <> · colunas ignoradas: {parsed.ignored.join(", ")}</>}
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>#</th><th>Nome</th><th>E-mail</th>{variables.map((key) => <th key={key}>{humanize(key)}</th>)}{hasPhoto && <th>Foto</th>}<th>Situação</th></tr></thead>
                    <tbody>
                      {rows.slice(0, 50).map((row) => (
                        <tr key={row.line}>
                          <td>{row.line}</td>
                          <td>{row.nome || "—"}</td>
                          <td>{row.email || "—"}</td>
                          {variables.map((key) => <td key={key}>{row[key] ? formatValue(key, row[key]) : <em>padrão</em>}</td>)}
                          {hasPhoto && <td>{row.foto ? "sim" : "—"}</td>}
                          <td>{row.problems.length ? <span className="is-bad">{row.problems.join(", ")}</span> : "ok"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 50 && <p className="adm-hint">Mostrando as 50 primeiras de {rows.length} linhas.</p>}
              </div>
            )}

            <button type="button" className="admin-button primary" onClick={issueBulk} disabled={busy || validRows.length === 0}>
              {busy ? "Emitindo..." : validRows.length ? `Emitir ${validRows.length} certificado(s) e baixar ZIP` : "Emitir em massa"}
            </button>
          </div>
        )}

        {progress && (
          <div className="adm-progress" role="status">
            <div className="adm-progress-bar"><span style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }} /></div>
            <small>{progress.label}: {progress.done}/{progress.total}</small>
          </div>
        )}

        {issued && (
          <div className="cert-result">
            <strong>{issued.kind === "single" ? "Certificado emitido" : `${issued.list.length} certificados emitidos`}</strong>
            {issued.kind === "single" ? (
              <>
                <p>Código de verificação: <code>{issued.list[0].code}</code></p>
                <div className="cert-row-actions">
                  <button type="button" className="adm-action" onClick={async () => notify((await copy(verifyUrl(issued.list[0].code))) ? "success" : "error", "Link de verificação copiado.")}>Copiar link de verificação</button>
                  <button type="button" className="adm-action" disabled={busy} onClick={async () => downloadBlob(await renderPdf({ template, certificate: issued.list[0] }), certificateFileName(issued.list[0].recipient_name, issued.list[0].code))}>Baixar de novo</button>
                </div>
              </>
            ) : (
              <div className="cert-row-actions">
                <button type="button" className="adm-action" disabled={busy} onClick={downloadMerged}>Baixar um PDF único (todas as páginas de todos)</button>
                <button type="button" className="adm-action" disabled={busy} onClick={async () => {
                  setBusy(true);
                  const zip = await buildZip({ items: issued.list.map((certificate) => ({ template, certificate })), onProgress: (done, total) => setProgress({ label: "Gerando PDFs", done, total }) });
                  downloadBlob(zip, `certificados-${slug(issued.label)}.zip`);
                  setProgress(null);
                  setBusy(false);
                }}>Baixar ZIP de novo</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cert-issue-preview">
        <h3>Pré-visualização</h3>
        {pages.length > 1 && (
          <div className="cert-pagebar" role="tablist" aria-label="Páginas do modelo">
            {pages.map((page, index) => (
              <button type="button" role="tab" key={page.id} aria-selected={index === previewPage} className={`${index === previewPage ? "is-active" : ""} ${includedPages.includes(page.id) ? "" : "is-off"}`} onClick={() => setPreviewPage(index)}>
                {page.name}
              </button>
            ))}
          </div>
        )}
        <CertificateCanvas template={template} page={currentPreview} values={previewValues} maxSide={1400} />
        <p className="adm-hint">O código e o QR reais são gerados na emissão.</p>
      </div>
    </div>
  );
}
