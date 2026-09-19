import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { certificateFileName, downloadBlob, formatDatePt, renderPdf, verifyUrl } from "../../services/certificates";
import "../../styles/certificates.css";

// "Meus certificados" na área do aluno. Some sozinho se não houver certificados (ou a migration 16 ainda não rodou).
export default function MyCertificates() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    // Filtra pelos PRÓPRIOS certificados (o admin, por RLS, enxergaria todos).
    const mine = `user_id.eq.${user.id}${user.email ? `,recipient_email.ilike.${user.email}` : ""}`;
    supabase
      .from("certificates")
      .select("id,code,recipient_name,data,issued_at,template:certificate_templates(*)")
      .eq("status", "valid")
      .or(mine)
      .order("issued_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (active && !loadError) setItems((data || []).filter((item) => item.template));
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (items.length === 0) return null;

  const download = async (item) => {
    setBusyId(item.id);
    setError("");
    try {
      downloadBlob(await renderPdf({ template: item.template, certificate: item }), certificateFileName(item.recipient_name, item.code));
    } catch {
      setError("Não foi possível gerar o PDF agora. Tente novamente.");
    }
    setBusyId(null);
  };

  return (
    <section className="portal-list cert-mine" style={{ marginTop: 24 }} aria-labelledby="my-certs-title">
      <h2 id="my-certs-title">Meus certificados</h2>
      {error && <p className="empty" role="alert">{error}</p>}
      {items.map((item) => (
        <article key={item.id}>
          <div>
            <strong>{item.template.name}</strong>
            <span>Emitido em {formatDatePt(item.issued_at)} · Código {item.code}</span>
          </div>
          <div className="cert-mine-actions">
            <button type="button" onClick={() => download(item)} disabled={busyId === item.id}>{busyId === item.id ? "Gerando..." : "Baixar PDF"}</button>
            <a href={verifyUrl(item.code)} target="_blank" rel="noreferrer">Verificar</a>
          </div>
        </article>
      ))}
    </section>
  );
}
