import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  title: "",
  slug: "",
  content_type: "artigo",
  category: "",
  published_at: todayIso(),
  summary: "",
  body: "",
  cover_url: "",
  download_url: "",
  status: "draft",
  display_order: 0,
  meta_title: "",
  meta_description: "",
};

const asText = (value) => (value === null || value === undefined ? "" : String(value));

function normalize(data = {}) {
  return {
    ...emptyForm,
    ...data,
    title: asText(data.title),
    slug: asText(data.slug),
    content_type: data.content_type === "material" ? "material" : "artigo",
    category: asText(data.category),
    published_at: asText(data.published_at) || todayIso(),
    summary: asText(data.summary),
    body: asText(data.body),
    cover_url: asText(data.cover_url),
    download_url: asText(data.download_url),
    status: asText(data.status) || "draft",
    display_order: data.display_order ?? 0,
    meta_title: asText(data.meta_title),
    meta_description: asText(data.meta_description),
  };
}

function slugify(value = "") {
  return asText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ContentEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [materialFile, setMaterialFile] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  useEffect(() => {
    if (!editing) return;
    supabase.from("site_content").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error) {
        setMessageType("error");
        setMessage(`Não foi possível carregar: ${error.message}`);
      } else {
        const normalized = normalize(data);
        setForm(normalized);
        setCoverPreview(normalized.cover_url);
      }
      setLoading(false);
    });
  }, [editing, id]);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !editing) next.slug = slugify(value);
      return next;
    });
  };

  const uploadToBucket = async (file, prefix) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("site-content").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`Falha ao enviar arquivo: ${error.message}`);
    const { data } = supabase.storage.from("site-content").getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Sua sessão expirou. Entre novamente no painel.");

      const title = asText(form.title).trim();
      if (!title) throw new Error("Informe o título.");

      const slug = slugify(asText(form.slug) || title);
      if (!slug) throw new Error("Informe um identificador válido para o endereço.");

      let coverUrl = asText(form.cover_url) || null;
      if (coverFile) coverUrl = await uploadToBucket(coverFile, "covers");

      let downloadUrl = asText(form.download_url).trim() || null;
      if (materialFile) downloadUrl = await uploadToBucket(materialFile, "materiais");

      if (form.content_type === "material" && !downloadUrl) {
        throw new Error("Envie um arquivo ou informe um link externo para o material.");
      }

      const payload = {
        title,
        slug,
        content_type: form.content_type,
        category: asText(form.category).trim() || null,
        published_at: asText(form.published_at) || todayIso(),
        summary: asText(form.summary).trim() || null,
        body: asText(form.body).trim() || null,
        cover_url: coverUrl,
        download_url: downloadUrl,
        status: asText(form.status) || "draft",
        display_order: Number(form.display_order) || 0,
        meta_title: asText(form.meta_title).trim() || null,
        meta_description: asText(form.meta_description).trim() || null,
      };

      const result = editing
        ? await supabase.from("site_content").update(payload).eq("id", id).select("*").single()
        : await supabase.from("site_content").insert(payload).select("*").single();

      if (result.error) throw result.error;

      const normalized = normalize(result.data);
      setForm(normalized);
      setCoverPreview(normalized.cover_url);
      setCoverFile(null);
      setMaterialFile(null);
      setMessageType("success");
      setMessage(editing ? "Salvo com sucesso." : "Criado com sucesso.");

      if (!editing) navigate(`/admin/conteudos/${result.data.id}`, { replace: true });
    } catch (error) {
      setMessageType("error");
      const text = error?.message || "Não foi possível salvar.";
      setMessage(
        text.includes("column") && text.includes("does not exist")
          ? "O banco ainda não tem os campos novos. Execute supabase/11_temas_e_etiquetas.sql no SQL Editor e tente novamente."
          : text
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="admin-section">Carregando...</section>;

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>CONTEÚDO</span>
          <h2>{editing ? "Editar item" : "Novo item"}</h2>
        </div>
        <button type="button" className="admin-button" onClick={() => navigate("/admin/conteudos")}>← Voltar</button>
      </div>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}

      <form className="admin-form" onSubmit={save} noValidate>
        <div className="check-grid">
          <label>
            <input
              type="radio"
              name="content_type"
              checked={form.content_type === "artigo"}
              onChange={() => update("content_type", "artigo")}
            />
            Conteúdo gratuito (artigo)
          </label>
          <label>
            <input
              type="radio"
              name="content_type"
              checked={form.content_type === "material"}
              onChange={() => update("content_type", "material")}
            />
            Material para download
          </label>
        </div>

        <div className="form-grid">
          <label>Título *<input value={form.title} onChange={(e) => update("title", e.target.value)} required /></label>
          <label>Resumo curto<textarea rows={2} value={form.summary} onChange={(e) => update("summary", e.target.value)} /></label>
          {form.content_type === "artigo" && (
            <label>Conteúdo<textarea rows={8} value={form.body} onChange={(e) => update("body", e.target.value)} /></label>
          )}
        </div>

        <div className="form-grid two">
          <label>Tema/categoria<input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="Ex: Trauma, Prática, Entrevista" /></label>
          <label>Data de publicação<input type="date" value={form.published_at} onChange={(e) => update("published_at", e.target.value)} /></label>
        </div>

        <div className="form-grid two">
          <label>Identificador do endereço<input value={form.slug} onChange={(e) => update("slug", e.target.value)} /></label>
          <label>
            Status
            <select value={form.status} onChange={(e) => update("status", e.target.value)}>
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="hidden">Oculto</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label>
            Imagem de capa
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
            {coverPreview && <img src={coverPreview} alt="Prévia" style={{ marginTop: 10, maxWidth: 320, borderRadius: 12 }} />}
          </label>

          {form.content_type === "material" && (
            <>
              <label>
                Arquivo (PDF ou imagem, até 20 MB)
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setMaterialFile(e.target.files?.[0] || null)} />
              </label>
              <label>
                Ou link externo para o material
                <input value={form.download_url} onChange={(e) => update("download_url", e.target.value)} placeholder="https://..." />
              </label>
            </>
          )}
        </div>

        <div className="form-grid two">
          <label>Ordem de exibição<input type="number" min="0" value={form.display_order} onChange={(e) => update("display_order", e.target.value)} /></label>
        </div>

        <div className="form-grid two">
          <label>SEO — título da página<input value={form.meta_title} onChange={(e) => update("meta_title", e.target.value)} /></label>
          <label>SEO — descrição<textarea rows={2} value={form.meta_description} onChange={(e) => update("meta_description", e.target.value)} /></label>
        </div>

        <div className="form-actions">
          <button className="admin-button primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
          <button className="admin-button" type="button" onClick={() => navigate("/admin/conteudos")}>Cancelar</button>
        </div>
      </form>
    </section>
  );
}
