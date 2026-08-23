import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

const emptyForm = {
  title: "",
  slug: "",
  short_description: "",
  full_description: "",
  cover_url: "",
  category: "",
  price: "",
  promotional_price: "",
  checkout_url: "",
  status: "active",
  is_featured: true,
  display_order: 0,
};

const asText = (value) => (value === null || value === undefined ? "" : String(value));

function normalizeProduct(data = {}) {
  return {
    ...emptyForm,
    ...data,
    title: asText(data.title),
    slug: asText(data.slug),
    short_description: asText(data.short_description),
    full_description: asText(data.full_description),
    cover_url: asText(data.cover_url),
    category: asText(data.category),
    price: data.price ?? "",
    promotional_price: data.promotional_price ?? "",
    checkout_url: asText(data.checkout_url),
    status: asText(data.status) || "active",
    is_featured: Boolean(data.is_featured),
    display_order: data.display_order ?? 0,
  };
}

function slugify(value = "") {
  return asText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) throw new Error("Informe um preço válido.");
  return number;
}

export default function ProductEditorPageV4() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  useEffect(() => {
    if (!editing) return;
    const load = async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) {
        setMessageType("error");
        setMessage(`Não foi possível carregar o produto: ${error.message}`);
      } else {
        const normalized = normalizeProduct(data);
        setForm(normalized);
        setPreview(normalized.cover_url);
      }
      setLoading(false);
    };
    load();
  }, [editing, id]);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !editing) next.slug = slugify(value);
      return next;
    });
  };

  const uploadCover = async () => {
    if (!imageFile) return asText(form.cover_url) || null;
    if (!imageFile.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
    if (imageFile.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");

    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `covers/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, imageFile, {
      cacheControl: "3600",
      contentType: imageFile.type,
      upsert: false,
    });
    if (error) throw new Error(`Falha ao enviar imagem: ${error.message}`);
    const { data } = supabase.storage.from("products").getPublicUrl(path);
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
      const shortDescription = asText(form.short_description).trim();
      const checkoutUrl = asText(form.checkout_url).trim();

      if (!title) throw new Error("Informe o título do produto.");
      if (!shortDescription) throw new Error("Informe a descrição curta.");
      if (!checkoutUrl) throw new Error("Informe o link de venda da Hotmart.");

      const slug = slugify(asText(form.slug) || title);
      if (!slug) throw new Error("Informe um identificador válido para o endereço.");

      const coverUrl = await uploadCover();
      const payload = {
        title,
        slug,
        short_description: shortDescription,
        full_description: asText(form.full_description).trim() || null,
        cover_url: coverUrl,
        category: asText(form.category).trim() || null,
        price: parseMoney(form.price),
        promotional_price: parseMoney(form.promotional_price),
        checkout_url: checkoutUrl,
        status: asText(form.status) || "active",
        is_featured: Boolean(form.is_featured),
        display_order: Number(form.display_order) || 0,
      };

      const result = editing
        ? await supabase.from("products").update(payload).eq("id", id).select("*").single()
        : await supabase.from("products").insert(payload).select("*").single();

      if (result.error) throw result.error;
      if (!result.data) throw new Error("O banco não confirmou a gravação do produto.");

      const normalized = normalizeProduct(result.data);
      setForm(normalized);
      setPreview(normalized.cover_url);
      setImageFile(null);
      setMessageType("success");
      setMessage(editing ? "Produto salvo com sucesso no banco de dados." : "Produto criado com sucesso no banco de dados.");

      if (!editing) navigate(`/admin/produtos/${result.data.id}`, { replace: true });
    } catch (error) {
      setMessageType("error");
      const text = error?.message || "Não foi possível salvar o produto.";
      setMessage(
        text.includes("row-level security") || text.includes("permission denied")
          ? "O Supabase bloqueou a gravação por permissão. Execute o arquivo 06_v4_fix_products_permissions.sql no SQL Editor e tente novamente."
          : text
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="admin-section">Carregando produto...</section>;

  return (
    <section className="admin-section">
      <style>{`
        .pe4-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:20px}.pe4-head h2{margin:4px 0 0;color:#071426;font-size:2rem}.pe4-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.12em}.pe4-back{border:1px solid #dbe3eb;border-radius:11px;background:#fff;padding:11px 15px;font-weight:900;cursor:pointer}.pe4-card{background:#fff;border:1px solid #e0e7ee;border-radius:20px;padding:24px;box-shadow:0 14px 40px rgba(7,20,38,.06)}.pe4-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pe4-field{display:grid;gap:7px}.pe4-field.full{grid-column:1/-1}.pe4-field label{font-size:.8rem;font-weight:900;color:#273d53}.pe4-field input,.pe4-field textarea,.pe4-field select{width:100%;border:1px solid #d6e0e9;border-radius:11px;padding:12px 13px;font:inherit;color:#13283c;background:#fff}.pe4-field textarea{min-height:105px;resize:vertical}.pe4-check{display:flex;align-items:center;gap:9px;font-weight:900;color:#273d53}.pe4-check input{width:18px;height:18px}.pe4-preview{margin-top:8px;max-width:360px;border-radius:14px;overflow:hidden;border:1px solid #e1e7ed}.pe4-preview img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.pe4-actions{display:flex;gap:10px;margin-top:22px}.pe4-save{flex:1;min-height:52px;border:0;border-radius:12px;background:#d6152d;color:#fff;font-weight:950;cursor:pointer}.pe4-save:disabled{opacity:.55}.pe4-cancel{min-height:52px;border:1px solid #dbe3eb;border-radius:12px;background:#fff;padding:0 18px;font-weight:900;cursor:pointer}.pe4-message{margin-bottom:18px;padding:14px 16px;border-radius:12px;font-weight:850}.pe4-message.success{background:#edf8f1;color:#236842;border:1px solid #c8e5d2}.pe4-message.error{background:#fff0f2;color:#a60d25;border:1px solid #f1c8cf}.pe4-help{font-size:.74rem;color:#7b8c9c}@media(max-width:700px){.pe4-head{align-items:stretch;flex-direction:column}.pe4-grid{grid-template-columns:1fr}.pe4-field.full{grid-column:auto}.pe4-actions{flex-direction:column}.pe4-card{padding:18px}}
      `}</style>

      <div className="pe4-head">
        <div><span>GESTÃO DE PRODUTOS</span><h2>{editing ? "Editar produto" : "Novo produto"}</h2></div>
        <button className="pe4-back" type="button" onClick={() => navigate("/admin/produtos")}>← Voltar</button>
      </div>

      {message && <div className={`pe4-message ${messageType}`}>{message}</div>}

      <form className="pe4-card" onSubmit={save} noValidate>
        <div className="pe4-grid">
          <div className="pe4-field full"><label>Título *</label><input value={asText(form.title)} onChange={(e) => update("title", e.target.value)} required /></div>
          <div className="pe4-field full"><label>Descrição curta *</label><textarea value={asText(form.short_description)} onChange={(e) => update("short_description", e.target.value)} required /></div>
          <div className="pe4-field full"><label>Descrição completa</label><textarea value={asText(form.full_description)} onChange={(e) => update("full_description", e.target.value)} /></div>
          <div className="pe4-field full"><label>Imagem de capa</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} /><span className="pe4-help">JPG, PNG ou WEBP. Máximo 5 MB.</span>{preview && <div className="pe4-preview"><img src={preview} alt="Prévia da capa" /></div>}</div>
          <div className="pe4-field full"><label>Link de venda Hotmart *</label><input type="url" value={asText(form.checkout_url)} onChange={(e) => update("checkout_url", e.target.value)} placeholder="https://pay.hotmart.com/..." required /></div>
          <div className="pe4-field"><label>Categoria</label><input value={asText(form.category)} onChange={(e) => update("category", e.target.value)} placeholder="E-book, curso, mentoria..." /></div>
          <div className="pe4-field"><label>Status</label><select value={asText(form.status) || "active"} onChange={(e) => update("status", e.target.value)}><option value="active">Ativo — aparece no site</option><option value="draft">Rascunho</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></div>
          <div className="pe4-field"><label>Preço normal</label><input inputMode="decimal" value={form.price ?? ""} onChange={(e) => update("price", e.target.value)} placeholder="0,00" /></div>
          <div className="pe4-field"><label>Preço promocional</label><input inputMode="decimal" value={form.promotional_price ?? ""} onChange={(e) => update("promotional_price", e.target.value)} placeholder="0,00" /></div>
          <div className="pe4-field"><label>Ordem de exibição</label><input type="number" min="0" value={form.display_order ?? 0} onChange={(e) => update("display_order", e.target.value)} /></div>
          <div className="pe4-field"><label>Identificador do endereço</label><input value={asText(form.slug)} onChange={(e) => update("slug", e.target.value)} /></div>
          <div className="pe4-field full"><label className="pe4-check"><input type="checkbox" checked={Boolean(form.is_featured)} onChange={(e) => update("is_featured", e.target.checked)} /> Destacar este produto no site</label></div>
        </div>
        <div className="pe4-actions"><button className="pe4-save" type="submit" disabled={saving}>{saving ? "Salvando no banco..." : "Salvar alterações"}</button><button className="pe4-cancel" type="button" onClick={() => navigate("/admin/produtos")}>Cancelar</button></div>
      </form>
    </section>
  );
}
