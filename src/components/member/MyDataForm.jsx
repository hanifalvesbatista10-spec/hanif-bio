import { useEffect, useRef, useState } from "react";
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

// Aba "Meus dados": nome, contato e os dados usados no certificado e na carteirinha.
export default function MyDataForm() {
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
    if (form.full_name.trim().length < 3) return notify("error", "Informe o nome completo, do jeito que deve sair no certificado.");
    if (form.cpf && !isValidCpf(form.cpf)) return notify("error", "O CPF não é válido. Confira os números.");
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
      notify("success", "Dados salvos. Vamos usá-los no seu certificado e na sua carteirinha.");
    } catch (error) {
      notify(
        "error",
        isMissingStudentColumns(error) || String(error.message || "").toLowerCase().includes("bucket")
          ? "Este recurso ainda não está ativo no sistema. Avise a equipe."
          : `Não foi possível salvar: ${error.message}`
      );
    }
    setSaving(false);
  };

  const shownPhoto = photoPreview || photoUrl;

  return (
    <form className="mb-card" onSubmit={save} noValidate>
      <div className="mb-card-head">
        <h2>Meus dados</h2>
        <p>
          Usamos estas informações para emitir o seu certificado e a sua carteirinha. Só você e a equipe do curso conseguem vê-las.
          O nome sai no certificado exatamente como estiver aqui.
        </p>
      </div>

      {message && <div className={`mb-alert ${messageType === "error" ? "is-error" : "is-success"}`} role={messageType === "error" ? "alert" : "status"}>{message}</div>}

      <div className="mb-data">
        <div className="mb-photo">
          <div className="mb-photo-frame">
            {shownPhoto ? <img src={shownPhoto} alt="Sua foto" /> : <span>Sem foto</span>}
          </div>
          <button type="button" className="mb-btn is-ghost is-small" onClick={() => fileRef.current?.click()} disabled={saving}>
            {shownPhoto ? "Trocar foto" : "Enviar foto"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} hidden />
          <small>Foto de rosto, de frente, com fundo claro. Cortamos no formato 3×4, pelo centro.</small>
        </div>

        <div className="mb-fields">
          <label className="mb-field is-wide">
            <span>Nome completo</span>
            <input value={form.full_name} onChange={set("full_name")} autoComplete="name" required />
          </label>
          <label className="mb-field is-wide">
            <span>E-mail</span>
            <input value={profile?.email || user?.email || ""} disabled />
            <small>É o e-mail do seu login e não dá para trocar por aqui.</small>
          </label>
          <label className="mb-field">
            <span>Telefone ou WhatsApp</span>
            <input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" />
          </label>
          <label className="mb-field">
            <span>CPF</span>
            <input value={form.cpf} onChange={(event) => setForm((current) => ({ ...current, cpf: formatCpf(event.target.value) }))} inputMode="numeric" placeholder="000.000.000-00" />
          </label>
          <label className="mb-field">
            <span>RG</span>
            <input value={form.rg} onChange={set("rg")} placeholder="Número do RG" />
          </label>
          <label className="mb-field">
            <span>Tipo sanguíneo</span>
            <select value={form.blood_type} onChange={set("blood_type")}>
              <option value="">Prefiro não informar</option>
              {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="mb-card-foot">
        <button className="mb-btn" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button>
      </div>
    </form>
  );
}
