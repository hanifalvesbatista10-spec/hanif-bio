import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import {
  BLOOD_TYPES,
  formatCpf,
  isMissingStudentColumns,
  isValidCpf,
  preparePhoto,
  removeStudentPhoto,
  uploadStudentPhoto,
} from "../../services/studentData";
import SecurityCard from "../../components/member/SecurityCard";
import "../../styles/student-profile.css";

export default function StudentProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ full_name: "", phone: "", cpf: "", rg: "", blood_type: "" });
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      cpf: profile.cpf || "",
      rg: profile.rg || "",
      blood_type: profile.blood_type || "",
    });
    setPhotoUrl(profile.avatar_url || "");
  }, [profile]);

  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const onPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("error", "Escolha uma imagem (JPG, PNG ou WebP).");
    if (file.size > 15 * 1024 * 1024) return notify("error", "A imagem é muito grande. Use uma foto de até 15 MB.");
    try {
      const blob = await preparePhoto(file);
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
      setMessage("");
    } catch (error) {
      notify("error", error.message);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (form.full_name.trim().length < 3) return notify("error", "Informe seu nome completo, como deve aparecer no certificado.");
    if (form.cpf && !isValidCpf(form.cpf)) return notify("error", "O CPF informado não é válido. Confira os números.");
    setSaving(true);
    setMessage("");
    try {
      let avatar = photoUrl;
      if (photoBlob) avatar = await uploadStudentPhoto(user.id, photoBlob);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          cpf: form.cpf ? formatCpf(form.cpf) : null,
          rg: form.rg.trim() || null,
          blood_type: form.blood_type || null,
          avatar_url: avatar || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      if (photoBlob && photoUrl && photoUrl !== avatar) await removeStudentPhoto(photoUrl);
      setPhotoBlob(null);
      setPhotoPreview("");
      await refreshProfile();
      notify("success", "Dados salvos. Eles serão usados no seu certificado e na sua carteirinha.");
    } catch (error) {
      notify(
        "error",
        isMissingStudentColumns(error) || String(error.message || "").toLowerCase().includes("bucket")
          ? "Este recurso ainda não foi ativado no sistema. Avise o administrador."
          : `Não foi possível salvar: ${error.message}`
      );
    }
    setSaving(false);
  };

  const shownPhoto = photoPreview || photoUrl;

  return (
    <div className="portal-page">
      <div className="portal-shell sp-shell">
        <header className="portal-header">
          <div>
            <span>ÁREA DO ALUNO</span>
            <h1>Meus dados</h1>
          </div>
          <Link className="sp-back" to="/minha-area">← Meus cursos</Link>
        </header>

        <form className="portal-list sp-card" onSubmit={save}>
          <p className="sp-intro">
            Estes dados servem apenas para emitir o seu <strong>certificado</strong> e a sua <strong>carteirinha</strong>. Só você e a equipe
            do curso conseguem vê-los. Confira o nome: ele sai no certificado exatamente como estiver aqui.
          </p>

          {message && <div className={`auth-message ${messageType}`} role="status">{message}</div>}

          <div className="sp-grid">
            <div className="sp-photo">
              <div className="sp-photo-frame">
                {shownPhoto ? <img src={shownPhoto} alt="Sua foto" /> : <span>Sem foto</span>}
              </div>
              <button type="button" className="sp-secondary" onClick={() => fileRef.current?.click()} disabled={saving}>
                {shownPhoto ? "Trocar foto" : "Enviar foto"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} hidden />
              <small>Foto de rosto, de frente, com fundo claro. Ela é cortada em 3×4 no centro.</small>
            </div>

            <div className="sp-fields">
              <label>Nome completo
                <input value={form.full_name} onChange={set("full_name")} autoComplete="name" required />
              </label>
              <label>E-mail
                <input value={profile?.email || user?.email || ""} disabled />
                <small>O e-mail é o do seu login e não pode ser alterado aqui.</small>
              </label>
              <label>Telefone / WhatsApp
                <input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" />
              </label>
              <label>CPF
                <input value={form.cpf} onChange={(e) => setForm((current) => ({ ...current, cpf: formatCpf(e.target.value) }))} inputMode="numeric" placeholder="000.000.000-00" />
              </label>
              <label>RG
                <input value={form.rg} onChange={set("rg")} placeholder="Número do RG" />
              </label>
              <label>Tipo sanguíneo
                <select value={form.blood_type} onChange={set("blood_type")}>
                  <option value="">Prefiro não informar</option>
                  {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            </div>
          </div>

          <button className="auth-primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar meus dados"}</button>
        </form>

        <SecurityCard />
      </div>
    </div>
  );
}
