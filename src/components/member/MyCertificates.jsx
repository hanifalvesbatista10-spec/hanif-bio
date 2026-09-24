import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { certificateFileName, downloadBlob, formatDatePt, renderPdf, verifyUrl } from "../../services/certificates";
import { memberIcons as icons } from "./MemberIcons";
import "../../styles/certificates.css";

// Lista dos certificados do aluno logado. Se a tabela ainda não existe (migration 16), aparece como se não houvesse nenhum.
export default function MyCertificates() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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
        if (!active) return;
        if (!loadError) setItems((data || []).filter((item) => item.template));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const download = async (item) => {
    setBusyId(item.id);
    setError("");
    try {
      downloadBlob(await renderPdf({ template: item.template, certificate: item }), certificateFileName(item.recipient_name, item.code));
    } catch {
      setError("Não foi possível gerar o PDF agora. Tente de novo em instantes.");
    }
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="mb-list" aria-hidden="true">
        <div className="mb-row is-skeleton"><i /></div>
        <div className="mb-row is-skeleton"><i /></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mb-empty">
        <span className="mb-empty-icon">{icons.certificate}</span>
        <h2>Nenhum certificado por aqui ainda</h2>
        <p>Quando a equipe emitir o seu certificado, ele aparece nesta página para você baixar em PDF.</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="mb-alert is-error" role="alert">{error}</div>}
      <ul className="mb-list">
        {items.map((item) => (
          <li className="mb-row" key={item.id}>
            <span className="mb-row-icon">{icons.certificate}</span>
            <div className="mb-row-text">
              <strong>{item.template.name}</strong>
              <span>Emitido em {formatDatePt(item.issued_at)} · Código <span className="mb-code">{item.code}</span></span>
            </div>
            <div className="mb-row-actions">
              <a className="mb-btn is-ghost is-small" href={verifyUrl(item.code)} target="_blank" rel="noreferrer">Verificar</a>
              <button type="button" className="mb-btn is-small" onClick={() => download(item)} disabled={busyId === item.id}>
                {busyId === item.id ? "Gerando..." : <>{icons.download} Baixar PDF</>}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
