import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

const initialForm = {
  title: "",
  slug: "",
  subtitle: "",
  short_description: "",
  full_description: "",
  cover_url: "",
  category: "",
  price: "",
  promotional_price: "",
  checkout_url: "",
  whatsapp_url: "",
  status: "draft",
  is_featured: false,
  display_order: 0,
};

function createSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ProductEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const title = editing ? "Editar produto" : "Adicionar novo produto";

  useEffect(() => {
    if (!editing) return;

    const loadProduct = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        setMessage(`Erro ao carregar produto: ${error.message}`);
      } else {
        setForm({
          ...initialForm,
          ...data,
          price: data.price ?? "",
          promotional_price: data.promotional_price ?? "",
        });
        setPreview(data.cover_url || "");
      }

      setLoading(false);
    };

    loadProduct();
  }, [editing, id]);

  useEffect(() => {
    if (!imageFile) return undefined;

    const url = URL.createObjectURL(imageFile);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const update = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "title" && !editing) {
        next.slug = createSlug(value);
      }

      return next;
    });
  };

  const uploadImage = async () => {
    if (!imageFile) return form.cover_url;

    setUploading(true);

    try {
      if (!imageFile.type.startsWith("image/")) {
        throw new Error("Selecione um arquivo de imagem.");
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error("A imagem deve ter no máximo 5 MB.");
      }

      const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const path = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(path, imageFile, {
          cacheControl: "3600",
          contentType: imageFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("products").getPublicUrl(path);

      if (!data?.publicUrl) {
        throw new Error("Não foi possível gerar o endereço público da imagem.");
      }

      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (!form.title.trim()) throw new Error("Informe o título do produto.");
      if (!form.short_description.trim()) {
        throw new Error("Informe uma descrição curta.");
      }
      if (!form.checkout_url.trim()) {
        throw new Error("Informe o link para onde o botão Comprar será direcionado.");
      }

      const coverUrl = await uploadImage();
      const slug = createSlug(form.slug || form.title);

      if (!slug) throw new Error("Não foi possível gerar o endereço do produto.");

      const payload = {
        title: form.title.trim(),
        slug,
        subtitle: form.subtitle.trim() || null,
        short_description: form.short_description.trim(),
        full_description: form.full_description.trim() || null,
        cover_url: coverUrl || null,
        category: form.category.trim() || null,
        price: form.price === "" ? null : Number(form.price),
        promotional_price:
          form.promotional_price === ""
            ? null
            : Number(form.promotional_price),
        checkout_url: form.checkout_url.trim(),
        whatsapp_url: form.whatsapp_url.trim() || null,
        status: form.status,
        is_featured: Boolean(form.is_featured),
        display_order: Number(form.display_order) || 0,
      };

      const query = editing
        ? supabase.from("products").update(payload).eq("id", id)
        : supabase.from("products").insert(payload);

      const { error } = await query;

      if (error) throw error;

      navigate("/admin/produtos", {
        replace: true,
        state: {
          success: editing
            ? "Produto atualizado com sucesso."
            : "Produto criado com sucesso.",
        },
      });
    } catch (error) {
      setMessage(error.message || "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <section className="admin-section">Carregando produto...</section>;
  }

  return (
    <section className="admin-section">
      <style>{`
        .product-editor-head{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:22px}
        .product-editor-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.12em}
        .product-editor-head h2{margin:4px 0 0;color:#071426;font-size:2rem}
        .product-editor-back{border:1px solid #dbe3eb;border-radius:11px;background:#fff;color:#20364d;padding:11px 15px;font-weight:900;cursor:pointer}
        .product-editor-grid{display:grid;grid-template-columns:1fr .72fr;gap:22px;align-items:start}
        .product-form-card,.product-preview-card{border:1px solid #e0e7ee;border-radius:20px;background:#fff;padding:24px;box-shadow:0 14px 40px rgba(7,20,38,.06)}
        .product-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .product-field{display:grid;gap:7px}
        .product-field.full{grid-column:1/-1}
        .product-field label{color:#273d53;font-size:.8rem;font-weight:900}
        .product-field input,.product-field textarea,.product-field select{width:100%;border:1px solid #d6e0e9;border-radius:11px;background:#fff;color:#13283c;padding:12px 13px;font:inherit;outline:none}
        .product-field textarea{resize:vertical;min-height:110px}
        .product-field input:focus,.product-field textarea:focus,.product-field select:focus{border-color:#d6152d;box-shadow:0 0 0 3px rgba(214,21,45,.09)}
        .product-checkbox{display:flex;align-items:center;gap:9px;color:#273d53;font-weight:800}
        .product-checkbox input{width:18px;height:18px}
        .product-form-actions{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:22px}
        .product-save{min-height:50px;border:0;border-radius:12px;background:#d6152d;color:#fff;font-weight:900;cursor:pointer}
        .product-cancel{min-height:50px;border:1px solid #dbe3eb;border-radius:12px;background:#fff;color:#253b52;padding:0 18px;font-weight:900;cursor:pointer}
        .product-save:disabled{opacity:.55;cursor:not-allowed}
        .product-preview-title{margin:0 0 16px;color:#071426}
        .product-image-preview{overflow:hidden;border-radius:16px;background:#eaf0f5;aspect-ratio:16/10;display:grid;place-items:center;color:#718397;font-weight:800}
        .product-image-preview img{width:100%;height:100%;object-fit:cover}
        .product-preview-card h3{margin:18px 0 8px;color:#071426;font-size:1.4rem}
        .product-preview-card p{margin:0;color:#66798c;line-height:1.6}
        .preview-price{display:flex;align-items:baseline;gap:9px;margin-top:15px}
        .preview-price strong{font-size:1.45rem;color:#071426}
        .preview-price del{color:#8a98a6}
        .preview-buy{margin-top:18px;min-height:50px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#d6152d;color:#fff;font-weight:900}
        .upload-help{font-size:.72rem;color:#7a8b9b}
        @media(max-width:900px){.product-editor-grid{grid-template-columns:1fr}.product-preview-card{order:-1}}
        @media(max-width:620px){.product-editor-head{align-items:stretch;flex-direction:column}.product-editor-back{width:100%}.product-fields{grid-template-columns:1fr}.product-field.full{grid-column:auto}.product-form-card,.product-preview-card{padding:19px}.product-form-actions{grid-template-columns:1fr}.product-cancel{order:2}}
      `}</style>

      <div className="product-editor-head">
        <div>
          <span>GESTÃO DE PRODUTOS</span>
          <h2>{title}</h2>
        </div>

        <button
          type="button"
          className="product-editor-back"
          onClick={() => navigate("/admin/produtos")}
        >
          ← Voltar para produtos
        </button>
      </div>

      {message && <div className="admin-alert error">{message}</div>}

      <div className="product-editor-grid">
        <form className="product-form-card" onSubmit={save}>
          <div className="product-fields">
            <div className="product-field full">
              <label htmlFor="product-title">Título do produto *</label>
              <input
                id="product-title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Ex.: Curso Completo de Atendimento ao Trauma"
                required
              />
            </div>

            <div className="product-field full">
              <label htmlFor="product-short-description">
                Descrição curta *
              </label>
              <textarea
                id="product-short-description"
                value={form.short_description}
                onChange={(event) =>
                  update("short_description", event.target.value)
                }
                placeholder="Explique de forma objetiva o que o cliente receberá."
                required
              />
            </div>

            <div className="product-field full">
              <label htmlFor="product-full-description">
                Descrição completa
              </label>
              <textarea
                id="product-full-description"
                value={form.full_description || ""}
                onChange={(event) =>
                  update("full_description", event.target.value)
                }
                placeholder="Detalhes adicionais, diferenciais, conteúdo e benefícios."
              />
            </div>

            <div className="product-field full">
              <label htmlFor="product-image">Imagem de capa</label>
              <input
                id="product-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setImageFile(event.target.files?.[0] || null)
                }
              />
              <span className="upload-help">
                JPG, PNG ou WEBP. Tamanho máximo: 5 MB. Proporção recomendada: 16:9.
              </span>
            </div>

            <div className="product-field full">
              <label htmlFor="product-checkout">Link de venda *</label>
              <input
                id="product-checkout"
                type="url"
                value={form.checkout_url || ""}
                onChange={(event) =>
                  update("checkout_url", event.target.value)
                }
                placeholder="https://pay.hotmart.com/..."
                required
              />
            </div>

            <div className="product-field">
              <label htmlFor="product-category">Categoria</label>
              <input
                id="product-category"
                value={form.category || ""}
                onChange={(event) => update("category", event.target.value)}
                placeholder="Curso, e-book, mentoria..."
              />
            </div>

            <div className="product-field">
              <label htmlFor="product-status">Status</label>
              <select
                id="product-status"
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
              >
                <option value="draft">Rascunho — não aparece no site</option>
                <option value="active">Ativo — aparece no site</option>
                <option value="inactive">Inativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>

            <div className="product-field">
              <label htmlFor="product-price">Preço normal</label>
              <input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => update("price", event.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="product-field">
              <label htmlFor="product-promotional-price">
                Preço promocional
              </label>
              <input
                id="product-promotional-price"
                type="number"
                min="0"
                step="0.01"
                value={form.promotional_price}
                onChange={(event) =>
                  update("promotional_price", event.target.value)
                }
                placeholder="0,00"
              />
            </div>

            <div className="product-field">
              <label htmlFor="product-order">Ordem de exibição</label>
              <input
                id="product-order"
                type="number"
                min="0"
                value={form.display_order}
                onChange={(event) =>
                  update("display_order", event.target.value)
                }
              />
            </div>

            <div className="product-field">
              <label htmlFor="product-slug">Identificador do endereço</label>
              <input
                id="product-slug"
                value={form.slug}
                onChange={(event) => update("slug", event.target.value)}
                placeholder="meu-novo-produto"
              />
            </div>

            <div className="product-field full">
              <label className="product-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(event) =>
                    update("is_featured", event.target.checked)
                  }
                />
                Destacar este produto no site
              </label>
            </div>
          </div>

          <div className="product-form-actions">
            <button
              type="submit"
              className="product-save"
              disabled={saving || uploading}
            >
              {saving || uploading
                ? "Salvando produto..."
                : editing
                  ? "Salvar alterações"
                  : "Criar produto"}
            </button>

            <button
              type="button"
              className="product-cancel"
              onClick={() => navigate("/admin/produtos")}
            >
              Cancelar
            </button>
          </div>
        </form>

        <aside className="product-preview-card">
          <h3 className="product-preview-title">Pré-visualização</h3>

          <div className="product-image-preview">
            {preview ? (
              <img src={preview} alt="Prévia da capa do produto" />
            ) : (
              "A imagem aparecerá aqui"
            )}
          </div>

          <h3>{form.title || "Título do produto"}</h3>
          <p>
            {form.short_description ||
              "A descrição curta do produto aparecerá neste espaço."}
          </p>

          {(form.price !== "" || form.promotional_price !== "") && (
            <div className="preview-price">
              {form.promotional_price !== "" ? (
                <>
                  <strong>
                    {Number(form.promotional_price).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                  {form.price !== "" && (
                    <del>
                      {Number(form.price).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </del>
                  )}
                </>
              ) : (
                <strong>
                  {Number(form.price).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
              )}
            </div>
          )}

          <span className="preview-buy">Comprar agora</span>
        </aside>
      </div>
    </section>
  );
}
