import { useEffect, useRef, useState } from "react";
import { icons } from "./AdminIcons";
import { supabase } from "../../services/supabase";
import { uploadFileToR2 } from "../../services/r2";

const MAX_MB = 50;

// Envia o e-book (PDF) de um produto para o Cloudflare R2 e grava o arquivo no produto (mesmos campos do editor de
// produto: ebook_file_path e ebook_file_name). Um e-book por produto: enviar de novo substitui o anterior.
export default function EbookDialog({ product, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const replacing = Boolean(product.ebook_file_path);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  const pick = (event) => {
    const picked = event.target.files?.[0] || null;
    setError("");
    if (picked && picked.type !== "application/pdf") {
      setError("Escolha um arquivo em PDF.");
      event.target.value = "";
      return setFile(null);
    }
    if (picked && picked.size > MAX_MB * 1024 * 1024) {
      setError(`O arquivo passa de ${MAX_MB} MB. Reduza o PDF antes de enviar.`);
      event.target.value = "";
      return setFile(null);
    }
    setFile(picked);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) return setError("Escolha o arquivo PDF do e-book.");
    setSaving(true);
    setError("");
    try {
      const { key, name } = await uploadFileToR2({ kind: "product", file });
      const { error: saveError } = await supabase.from("products").update({ ebook_file_path: key, ebook_file_name: name }).eq("id", product.id);
      if (saveError) throw new Error(saveError.message);
      onSaved(replacing ? "E-book substituído." : "E-book enviado. Quem comprou este produto já pode baixar.");
    } catch (failure) {
      setError(failure.message || "Não foi possível enviar o e-book.");
      setSaving(false);
    }
  };

  return (
    <div className="adm-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="ebook-dialog-title">
        <form onSubmit={submit}>
          <header className="adm-dialog-head">
            <h3 id="ebook-dialog-title">{replacing ? "Substituir o e-book" : "Enviar e-book (PDF)"}</h3>
            <button type="button" className="adm-icon-button" aria-label="Fechar" onClick={onClose} disabled={saving}>{icons.close}</button>
          </header>
          <div className="adm-dialog-body">
            <p className="adm-hint">
              Produto: <strong>{product.title}</strong>. O aluno que comprou baixa o arquivo na página do curso, na área de membros.
              {replacing && ` Arquivo atual: ${product.ebook_file_name || "sem nome"}. Ao enviar um novo, ele substitui o atual.`}
            </p>
            <label>
              Arquivo PDF (até {MAX_MB} MB)
              <input ref={inputRef} type="file" accept="application/pdf" onChange={pick} disabled={saving} />
            </label>
            {file && <p className="adm-hint">{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</p>}
            <p className="adm-hint">O arquivo fica num armazenamento privado (Cloudflare R2). Só quem tem acesso ao produto consegue baixar, com um link que expira em poucos minutos.</p>
            {error && <div className="admin-alert error" role="alert">{error}</div>}
          </div>
          <footer className="adm-dialog-foot">
            <button type="button" className="admin-button adm-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="admin-button primary" disabled={saving || !file}>{saving ? "Enviando..." : replacing ? "Substituir e-book" : "Enviar e-book"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
