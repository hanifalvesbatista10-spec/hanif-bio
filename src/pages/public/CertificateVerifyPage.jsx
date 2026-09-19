import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CertificateCanvas from "../../components/certificates/CertificateCanvas";
import { supabase } from "../../services/supabase";
import { activePages, certificateFileName, downloadBlob, formatDatePt, renderPdf, valuesForCertificate } from "../../services/certificates";
import "../../styles/certificates.css";

export default function CertificateVerifyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(code ? "loading" : "form");
  const [cert, setCert] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!code) {
      setState("form");
      return undefined;
    }
    let active = true;
    setState("loading");
    supabase.rpc("get_certificate", { p_code: code }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setState("notfound");
      else {
        setCert(data);
        setState(data.status === "valid" ? "valid" : "revoked");
      }
    });
    return () => {
      active = false;
    };
  }, [code]);

  const template = cert ? cert.template : null;
  const certificate = cert ? { code: cert.code, recipient_name: cert.recipient_name, data: cert.data, issued_at: cert.issued_at } : null;

  const shownPages = cert ? activePages(template, cert.data) : [];

  const download = async () => {
    setBusy(true);
    try {
      downloadBlob(await renderPdf({ template, certificate }), certificateFileName(certificate.recipient_name, certificate.code));
    } finally {
      setBusy(false);
    }
  };

  const search = (event) => {
    event.preventDefault();
    const clean = input.trim().toUpperCase();
    if (clean) navigate(`/certificado/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="cert-public">
      <header className="cert-public-top">
        <div className="cert-public-inner">
          <Link to="/" className="cert-public-brand">HANIF ALVES<span>APH • URGÊNCIA • EMERGÊNCIA</span></Link>
          <Link to="/" className="cert-public-back">← Voltar ao site</Link>
        </div>
      </header>

      <main className="cert-public-main">
        {state === "loading" && <p className="cert-public-note">Verificando certificado...</p>}

        {(state === "form" || state === "notfound") && (
          <div className="cert-public-card">
            <h1>Verificar certificado</h1>
            {state === "notfound" && <p className="cert-public-bad" role="alert">Não encontramos nenhum certificado com o código <code>{code}</code>. Confira se digitou corretamente.</p>}
            <p>Digite o código que aparece no certificado (ex.: <code>HA-3F9A1-C07BE</code>) ou leia o QR code.</p>
            <form onSubmit={search} className="cert-public-form">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="HA-XXXXX-XXXXX" aria-label="Código do certificado" autoCapitalize="characters" />
              <button type="submit">Verificar</button>
            </form>
          </div>
        )}

        {(state === "valid" || state === "revoked") && cert && (
          <div className="cert-public-result">
            <div className={`cert-public-status ${state === "valid" ? "is-valid" : "is-revoked"}`} role="status">
              <strong>{state === "valid" ? "✓ Certificado autêntico" : "Certificado revogado"}</strong>
              <span>
                {state === "valid"
                  ? `Emitido para ${cert.recipient_name} em ${formatDatePt(cert.issued_at)}.`
                  : "Este certificado foi cancelado pelo emissor e não é mais válido."}
              </span>
              <small>Código {cert.code}</small>
            </div>

            {state === "valid" && (
              <>
                {shownPages.length > 1 && (
                  <div className="cert-pagebar" role="tablist" aria-label="Páginas do certificado">
                    {shownPages.map((item, index) => (
                      <button type="button" role="tab" key={item.id} aria-selected={index === pageIndex} className={index === pageIndex ? "is-active" : ""} onClick={() => setPageIndex(index)}>{item.name}</button>
                    ))}
                  </div>
                )}
                <CertificateCanvas template={template} page={shownPages[pageIndex] || shownPages[0]} values={valuesForCertificate(certificate)} maxSide={1600} className="cert-public-stage" />
                <button type="button" className="cert-public-download" onClick={download} disabled={busy}>{busy ? "Gerando PDF..." : "Baixar certificado em PDF"}</button>
              </>
            )}
            <Link to="/certificado" className="cert-public-again">Verificar outro código</Link>
          </div>
        )}
      </main>
    </div>
  );
}
