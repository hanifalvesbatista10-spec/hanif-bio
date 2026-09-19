import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import IssuePanel from "../../components/certificates/IssuePanel";
import IssuedPanel from "../../components/certificates/IssuedPanel";
import TemplatesPanel from "../../components/certificates/TemplatesPanel";
import { supabase } from "../../services/supabase";
import { isMissingCertTables } from "../../services/certificates";
import "../../styles/certificates.css";

const TABS = [
  ["emitir", "Emitir"],
  ["emitidos", "Emitidos"],
  ["modelos", "Modelos"],
];

export default function CertificatesPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get("aba")) ? params.get("aba") : "emitir";
  const initialTemplate = params.get("modelo") || "";

  const [templates, setTemplates] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = useCallback((type, text) => {
    setMessageType(type);
    setMessage(text);
  }, []);

  const load = useCallback(async () => {
    const [templatesResult, certsResult] = await Promise.all([
      supabase.from("certificate_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("certificates").select("*").order("issued_at", { ascending: false }).limit(1000),
    ]);
    const error = templatesResult.error || certsResult.error;
    if (error) {
      if (isMissingCertTables(error)) setMissing(true);
      else notify("error", `Erro ao carregar: ${error.message}`);
    } else {
      setMissing(false);
      setTemplates(templatesResult.data || []);
      setCertificates(certsResult.data || []);
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const goTab = (id, extra = {}) => setParams({ aba: id, ...extra }, { replace: true });

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Certificados</h2>
        </div>
        <Link className="admin-button primary" to="/admin/certificados/modelo/novo">+ Novo modelo</Link>
      </div>

      <p className="adm-lead">
        Envie a arte pronta do certificado, posicione os textos (nome, curso, data…) e emita um por um ou em massa a partir de uma lista.
        Cada certificado ganha um código de verificação público.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      {missing ? (
        <div className="admin-alert error">
          O banco ainda não tem as tabelas de certificados. Execute <strong>supabase/16_certificados.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      ) : (
        <>
          <div className="adm-segment adm-tabs" role="tablist" aria-label="Certificados">
            {TABS.map(([id, label]) => (
              <button type="button" role="tab" key={id} aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => goTab(id)}>
                {label}
                {id === "emitidos" && <span className="adm-count is-neutral">{certificates.length}</span>}
                {id === "modelos" && <span className="adm-count is-neutral">{templates.length}</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="admin-empty">Carregando...</div>
          ) : tab === "emitir" ? (
            <IssuePanel key={initialTemplate || "default"} templates={templates} initialTemplateId={initialTemplate} onIssued={load} />
          ) : tab === "emitidos" ? (
            <IssuedPanel certificates={certificates} templates={templates} onChange={setCertificates} notify={notify} />
          ) : (
            <TemplatesPanel templates={templates} certificates={certificates} onChange={setTemplates} notify={notify} onIssueWith={(id) => goTab("emitir", { modelo: id })} />
          )}
        </>
      )}
    </section>
  );
}
