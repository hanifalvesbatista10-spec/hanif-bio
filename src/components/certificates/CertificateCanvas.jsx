import { useEffect, useRef, useState } from "react";
import { getPages, renderCertificate } from "../../services/certificates";
import "../../styles/certificate-fonts.css";

// Desenha UMA página do certificado em um <canvas> (mesmo motor usado no PDF). Aceita children para
// sobrepor alças de edição na mesma área.
export default function CertificateCanvas({ template, page, pageIndex = 0, values, onMetrics, maxSide = 1600, placeholders = false, children, className = "" }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const current = page || getPages(template)[pageIndex] || getPages(template)[0];
  const key = JSON.stringify([current, values, placeholders]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    renderCertificate({ template, page: current, values, canvas: canvasRef.current, maxSide, placeholders })
      .then(({ canvas, metrics }) => {
        if (cancelled) return;
        setError("");
        onMetrics?.(metrics, { width: canvas.width, height: canvas.height });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maxSide]);

  return (
    <div className={`cert-stage ${className}`} style={{ aspectRatio: `${current.width} / ${current.height}` }}>
      <canvas ref={canvasRef} className="cert-canvas" role="img" aria-label={`Pré-visualização: ${current.name || "certificado"}`} />
      {busy && <div className="cert-stage-note">Desenhando...</div>}
      {error && <div className="cert-stage-note is-error" role="alert">{error}</div>}
      {children}
    </div>
  );
}
