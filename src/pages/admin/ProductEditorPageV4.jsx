import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { uploadFileToR2 } from "../../services/r2";
import ProductLinks from "../../components/admin/ProductLinks";

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
  checkout_mode: "external",
  whatsapp_url: "",
  access_hold_enabled: false,
  highlights_text: "",
  status: "active",
  is_featured: true,
  display_order: 0,
  faq: [],
  format: "",
  duration: "",
  availability_status: "",
  bumps: [],
  ebook_file_path: "",
  ebook_file_name: "",
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
    checkout_mode: ["internal", "whatsapp"].includes(data.checkout_mode) ? data.checkout_mode : "external",
    has_checkout_mode: "checkout_mode" in data, // false = o SQL 19 ainda não foi executado
    whatsapp_url: asText(data.whatsapp_url),
    access_hold_enabled: data.access_hold_enabled !== false,
    has_access_hold: "access_hold_enabled" in data, // false = o SQL 30 ainda não foi executado
    highlights_text: Array.isArray(data.highlights) ? data.highlights.join("\n") : "",
    has_highlights: "highlights" in data, // false = o SQL 31 ainda não foi executado
    status: asText(data.status) || "active",
    is_featured: Boolean(data.is_featured),
    display_order: data.display_order ?? 0,
    format: asText(data.format),
    duration: asText(data.duration),
    availability_status: asText(data.availability_status),
    faq: Array.isArray(data.faq)
      ? data.faq.map((item) => ({ question: asText(item?.question), answer: asText(item?.answer) }))
      : [],
    ebook_file_path: asText(data.ebook_file_path),
    ebook_file_name: asText(data.ebook_file_name),
    has_ebook_file: "ebook_file_path" in data, // false = o SQL 40 ainda não foi executado
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
  const [ebookFile, setEbookFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // versão gravada no banco: os links usam o endereço salvo, não o que está sendo digitado
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [catalog, setCatalog] = useState([]); // todos os produtos, para escolher o bump

  useEffect(() => {
    supabase
      .from("products")
      .select("id,title,status")
      .order("title")
      .then(({ data }) => setCatalog(data || []));
  }, []);

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
        setSaved(normalized);
        setPreview(normalized.cover_url);

        const { data: bumpRows } = await supabase
          .from("product_bumps")
          .select("id,bump_product_id,price_cents")
          .eq("product_id", id)
          .order("display_order");
        setForm((current) => ({
          ...current,
          bumps: (bumpRows || []).map((row) => ({
            id: row.id,
            bump_product_id: row.bump_product_id,
            price_reais: String(Number(row.price_cents) / 100).replace(".", ","),
          })),
        }));
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

  const updateFaqItem = (index, key, value) => {
    setForm((current) => {
      const faq = current.faq.slice();
      faq[index] = { ...faq[index], [key]: value };
      return { ...current, faq };
    });
  };

  const addFaqItem = () => {
    setForm((current) => ({ ...current, faq: [...current.faq, { question: "", answer: "" }] }));
  };

  const removeFaqItem = (index) => {
    setForm((current) => ({ ...current, faq: current.faq.filter((_, i) => i !== index) }));
  };

  const addBumpRow = () => {
    setForm((current) => ({ ...current, bumps: [...current.bumps, { bump_product_id: "", price_reais: "" }] }));
  };

  const updateBumpRow = (index, key, value) => {
    setForm((current) => {
      const bumps = current.bumps.slice();
      bumps[index] = { ...bumps[index], [key]: value };
      return { ...current, bumps };
    });
  };

  const removeBumpRow = (index) => {
    setForm((current) => ({ ...current, bumps: current.bumps.filter((_, i) => i !== index) }));
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

  // Arquivo do e-book: sobe direto pro Cloudflare R2 — ninguém baixa pelo link direto, só quem
  // comprou (confere via /api/r2-sign-download, com o acesso ativo em user_products).
  const uploadEbookFile = async () => {
    if (!ebookFile) return { path: asText(form.ebook_file_path) || null, name: asText(form.ebook_file_name) || null };
    if (ebookFile.type !== "application/pdf") throw new Error("O arquivo do e-book precisa ser um PDF.");
    if (ebookFile.size > 50 * 1024 * 1024) throw new Error("O arquivo do e-book deve ter no máximo 50 MB.");

    const { key, name } = await uploadFileToR2({ kind: "product", file: ebookFile });
    return { path: key, name };
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
      const internal = form.checkout_mode === "internal";
      const whatsapp = form.checkout_mode === "whatsapp";
      if (internal && !((parseMoney(form.promotional_price) || 0) > 0 || (parseMoney(form.price) || 0) > 0)) {
        throw new Error("Para usar o checkout do site, informe o preço do produto (mínimo R$ 5,00).");
      }
      if (!internal && !whatsapp && !checkoutUrl) throw new Error("Informe o link de venda (Hotmart, Kiwify ou outro) ou escolha outro modo de venda.");

      const slug = slugify(asText(form.slug) || title);
      if (!slug) throw new Error("Informe um identificador válido para o endereço.");

      const coverUrl = await uploadCover();
      const ebookResult = await uploadEbookFile();
      const payload = {
        title,
        slug,
        short_description: shortDescription,
        full_description: asText(form.full_description).trim() || null,
        cover_url: coverUrl,
        category: asText(form.category).trim() || null,
        format: asText(form.format).trim() || null,
        duration: asText(form.duration).trim() || null,
        availability_status: asText(form.availability_status).trim() || null,
        price: parseMoney(form.price),
        promotional_price: parseMoney(form.promotional_price),
        checkout_url: checkoutUrl || null,
        whatsapp_url: asText(form.whatsapp_url).trim() || null,
        // só envia o campo se o banco já o tem (evita quebrar o salvamento antes do SQL 19)
        ...(internal || whatsapp || form.has_checkout_mode ? { checkout_mode: internal ? "internal" : whatsapp ? "whatsapp" : "external" } : {}),
        ...(form.has_access_hold ? { access_hold_enabled: Boolean(form.access_hold_enabled) } : {}),
        ...(form.has_highlights ? { highlights: form.highlights_text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6) } : {}),
        ...(form.has_ebook_file ? { ebook_file_path: ebookResult.path, ebook_file_name: ebookResult.name } : {}),
        status: asText(form.status) || "active",
        is_featured: Boolean(form.is_featured),
        display_order: Number(form.display_order) || 0,
        faq: (form.faq || [])
          .map((item) => ({ question: asText(item.question).trim(), answer: asText(item.answer).trim() }))
          .filter((item) => item.question && item.answer),
      };

      const result = editing
        ? await supabase.from("products").update(payload).eq("id", id).select("*").single()
        : await supabase.from("products").insert(payload).select("*").single();

      if (result.error) throw result.error;
      if (!result.data) throw new Error("O banco não confirmou a gravação do produto.");

      const normalized = normalizeProduct(result.data);
      setSaved(normalized);

      if (editing) {
        const validBumps = (form.bumps || [])
          .map((row) => ({
            bump_product_id: row.bump_product_id,
            price_cents: Math.round((parseMoney(row.price_reais) || 0) * 100),
          }))
          .filter((row) => row.bump_product_id && row.price_cents > 0);

        const { error: deleteError } = await supabase.from("product_bumps").delete().eq("product_id", id);
        if (deleteError) throw new Error(`Não foi possível salvar as ofertas extras: ${deleteError.message}`);

        if (validBumps.length > 0) {
          const { error: insertError } = await supabase.from("product_bumps").insert(
            validBumps.map((row, index) => ({ ...row, product_id: id, display_order: index }))
          );
          if (insertError) throw new Error(`Não foi possível salvar as ofertas extras: ${insertError.message}`);
        }
      }

      navigate("/admin/produtos");
    } catch (error) {
      setMessageType("error");
      const text = error?.message || "Não foi possível salvar o produto.";
      setMessage(
        text.includes("row-level security") || text.includes("permission denied")
          ? "O Supabase bloqueou a gravação por permissão. Execute o arquivo 06_v4_fix_products_permissions.sql no SQL Editor e tente novamente."
          : text.includes("products_checkout_mode_check")
          ? "O banco ainda não aceita o modo de venda por WhatsApp. Execute supabase/42_venda_por_whatsapp.sql no SQL Editor e tente novamente."
          : text.includes("checkout_mode")
          ? "O banco ainda não tem o checkout próprio. Execute supabase/19_checkout_proprio.sql no SQL Editor e tente novamente."
          : text.includes("access_hold_enabled")
          ? "O banco ainda não tem a garantia de 7 dias. Execute supabase/30_garantia_7_dias.sql no SQL Editor e tente novamente."
          : text.includes("highlights")
          ? "O banco ainda não tem os destaques do produto. Execute supabase/31_produto_destaques.sql no SQL Editor e tente novamente."
          : text.includes("ebook_file_path")
          ? "O banco ainda não tem o arquivo de e-book. Execute supabase/40_ebook_arquivo_do_produto.sql no SQL Editor e tente novamente."
          : text.includes("column") && text.includes("does not exist")
          ? "O banco ainda não tem os campos novos. Execute supabase/11_temas_e_etiquetas.sql no SQL Editor e tente novamente."
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
        .pe4-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:20px}.pe4-head h2{margin:4px 0 0;color:#071426;font-size:2rem}.pe4-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.12em}.pe4-back{border:1px solid #dbe3eb;border-radius:11px;background:#fff;padding:11px 15px;font-weight:900;cursor:pointer}.pe4-card{background:#fff;border:1px solid #e0e7ee;border-radius:20px;padding:24px;box-shadow:0 14px 40px rgba(7,20,38,.06)}.pe4-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pe4-field{display:grid;gap:7px}.pe4-field.full{grid-column:1/-1}.pe4-field label{font-size:.8rem;font-weight:900;color:#273d53}.pe4-field input,.pe4-field textarea,.pe4-field select{width:100%;border:1px solid #d6e0e9;border-radius:11px;padding:12px 13px;font:inherit;color:#13283c;background:#fff}.pe4-field textarea{min-height:105px;resize:vertical}.pe4-check{display:flex;align-items:center;gap:9px;font-weight:900;color:#273d53}.pe4-check input{width:18px;height:18px}.pe4-preview{margin-top:8px;max-width:360px;border-radius:14px;overflow:hidden;border:1px solid #e1e7ed}.pe4-preview img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.pe4-actions{display:flex;gap:10px;margin-top:22px}.pe4-save{flex:1;min-height:52px;border:0;border-radius:12px;background:#d6152d;color:#fff;font-weight:950;cursor:pointer}.pe4-save:disabled{opacity:.55}.pe4-cancel{min-height:52px;border:1px solid #dbe3eb;border-radius:12px;background:#fff;padding:0 18px;font-weight:900;cursor:pointer}.pe4-message{margin-bottom:18px;padding:14px 16px;border-radius:12px;font-weight:850}.pe4-message.success{background:#edf8f1;color:#236842;border:1px solid #c8e5d2}.pe4-message.error{background:#fff0f2;color:#a60d25;border:1px solid #f1c8cf}.pe4-help{font-size:.74rem;color:#7b8c9c}.pe4-faq{margin-top:22px;padding-top:20px;border-top:1px solid #e7edf2}.pe4-faq-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.pe4-faq-head label{font-size:.8rem;font-weight:900;color:#273d53}.pe4-faq-add{border:1px solid #d6e0e9;border-radius:10px;background:#fff;padding:8px 12px;font-weight:900;font-size:.8rem;cursor:pointer;color:#13283c}.pe4-faq-item{display:grid;grid-template-columns:1fr 1.4fr auto;gap:10px;align-items:start;margin-bottom:10px}.pe4-faq-item input,.pe4-faq-item textarea{border:1px solid #d6e0e9;border-radius:10px;padding:10px 12px;font:inherit;color:#13283c}.pe4-faq-item textarea{min-height:44px;resize:vertical}.pe4-faq-remove{border:1px solid #f1c8cf;border-radius:10px;background:#fff0f2;color:#a60d25;font-weight:900;font-size:.78rem;padding:0 12px;cursor:pointer;height:44px}@media(max-width:700px){.pe4-faq-item{grid-template-columns:1fr}.pe4-head{align-items:stretch;flex-direction:column}.pe4-grid{grid-template-columns:1fr}.pe4-field.full{grid-column:auto}.pe4-actions{flex-direction:column}.pe4-card{padding:18px}}
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
          <div className="pe4-field full">
            <label>Destaques do produto (um por linha, até 6)</label>
            <textarea value={form.highlights_text} onChange={(e) => update("highlights_text", e.target.value)} placeholder={"Mentoria semanal ao vivo\nSimulados corrigidos\nGrupo exclusivo"} />
            <span className="pe4-help">Aparece em bullets no card do produto (site e home), abaixo da descrição curta. Frases curtas e concretas funcionam melhor.</span>
          </div>
          <div className="pe4-field full"><label>Imagem de capa</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} /><span className="pe4-help">JPG, PNG ou WEBP. Máximo 5 MB.</span>{preview && <div className="pe4-preview"><img src={preview} alt="Prévia da capa" /></div>}</div>
          <div className="pe4-field full">
            <label>Arquivo do e-book (opcional)</label>
            <input type="file" accept="application/pdf" onChange={(e) => setEbookFile(e.target.files?.[0] || null)} />
            <span className="pe4-help">
              PDF, até 50 MB. Fica num armazenamento privado — só quem comprou o produto consegue baixar, pela área de membros.
              {ebookFile ? ` Selecionado agora: ${ebookFile.name} (salva ao clicar em "Salvar alterações").` : form.ebook_file_name ? ` Arquivo atual: ${form.ebook_file_name}.` : ""}
            </span>
            {!ebookFile && form.ebook_file_path && (
              <button
                type="button"
                className="pe4-faq-add"
                style={{ justifySelf: "start" }}
                onClick={() => setForm((current) => ({ ...current, ebook_file_path: "", ebook_file_name: "" }))}
              >
                Remover arquivo atual
              </button>
            )}
          </div>
          <div className="pe4-field full">
            <label>Como este produto é vendido</label>
            <select value={form.checkout_mode} onChange={(e) => update("checkout_mode", e.target.value)}>
              <option value="external">Link de venda externo (Hotmart, Kiwify ou outro)</option>
              <option value="internal">Checkout do próprio site (Pix, cartão e boleto)</option>
              <option value="whatsapp">Falar no WhatsApp (sem preço fixo)</option>
            </select>
            {form.checkout_mode === "internal" ? (
              <span className="pe4-help">O comprador paga no seu site e o acesso é liberado sozinho quando o pagamento é confirmado. Exige o preço abaixo e a InfinitePay configurada (veja docs/checkout.md). O preço cobrado é o promocional, se houver, ou o normal.</span>
            ) : form.checkout_mode === "whatsapp" ? (
              <span className="pe4-help">Sem checkout e sem preço fixo: o botão do site leva direto para uma conversa no seu WhatsApp. Use para produtos sob consulta (ex: valor combinado por turma ou cliente).</span>
            ) : (
              <span className="pe4-help">O botão Comprar leva para o link abaixo, e o acesso do aluno continua sendo liberado por você em Acessos dos alunos.</span>
            )}
          </div>
          {form.checkout_mode === "external" && (
            <div className="pe4-field full"><label>Link de venda *</label><input type="url" value={asText(form.checkout_url)} onChange={(e) => update("checkout_url", e.target.value)} placeholder="https://pay.hotmart.com/..." /></div>
          )}
          {form.checkout_mode === "whatsapp" && (
            <div className="pe4-field full">
              <label>Link do WhatsApp (opcional)</label>
              <input type="url" value={asText(form.whatsapp_url)} onChange={(e) => update("whatsapp_url", e.target.value)} placeholder="https://wa.me/55..." />
              <span className="pe4-help">Deixe em branco para usar o WhatsApp padrão do site, configurado em Conteúdo do site.</span>
            </div>
          )}
          <div className="pe4-field"><label>Categoria</label><input value={asText(form.category)} onChange={(e) => update("category", e.target.value)} placeholder="E-book, curso, mentoria..." /></div>
          <div className="pe4-field"><label>Status</label><select value={asText(form.status) || "active"} onChange={(e) => update("status", e.target.value)}><option value="active">Ativo — aparece no site</option><option value="unlisted">Oculto — só abre com o link direto</option><option value="draft">Rascunho</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></div>
          <div className="pe4-field"><label>Preço normal</label><input inputMode="decimal" value={form.price ?? ""} onChange={(e) => update("price", e.target.value)} placeholder="0,00" /></div>
          <div className="pe4-field"><label>Preço promocional</label><input inputMode="decimal" value={form.promotional_price ?? ""} onChange={(e) => update("promotional_price", e.target.value)} placeholder="0,00" /></div>
          <div className="pe4-field"><label>Ordem de exibição</label><input type="number" min="0" value={form.display_order ?? 0} onChange={(e) => update("display_order", e.target.value)} /></div>
          <div className="pe4-field"><label>Identificador do endereço</label><input value={asText(form.slug)} onChange={(e) => update("slug", e.target.value)} /></div>
          <div className="pe4-field"><label>Formato</label><input value={asText(form.format)} onChange={(e) => update("format", e.target.value)} placeholder="On-line, Presencial, Híbrido..." /></div>
          <div className="pe4-field"><label>Duração</label><input value={asText(form.duration)} onChange={(e) => update("duration", e.target.value)} placeholder="Ex: 16h, 4 semanas..." /></div>
          <div className="pe4-field"><label>Disponibilidade</label><input value={asText(form.availability_status)} onChange={(e) => update("availability_status", e.target.value)} placeholder="Disponível, Em breve, Turmas abertas..." /></div>
          <div className="pe4-field full"><label className="pe4-check"><input type="checkbox" checked={Boolean(form.is_featured)} onChange={(e) => update("is_featured", e.target.checked)} /> Destacar este produto no site</label></div>
          {form.checkout_mode === "internal" && (
            <div className="pe4-field full">
              <label className="pe4-check"><input type="checkbox" checked={Boolean(form.access_hold_enabled)} onChange={(e) => update("access_hold_enabled", e.target.checked)} /> Garantia de 7 dias: limitar o que o aluno vê logo depois de comprar</label>
              <span className="pe4-help">Desligada por padrão. Nos primeiros 7 dias (prazo legal de arrependimento), o aluno só vê as aulas marcadas como amostra em Aulas. <strong>Antes de ligar, marque em Aulas pelo menos uma aula como "amostra" deste curso</strong> — senão o aluno não vê nenhuma aula nos primeiros 7 dias.</span>
            </div>
          )}
        </div>

        <div className="pe4-faq">
          <div className="pe4-faq-head">
            <label>Perguntas frequentes deste produto</label>
            <button type="button" className="pe4-faq-add" onClick={addFaqItem}>+ Adicionar pergunta</button>
          </div>
          {form.faq.length === 0 && <span className="pe4-help">Nenhuma pergunta cadastrada ainda.</span>}
          {form.faq.map((item, index) => (
            <div className="pe4-faq-item" key={index}>
              <input
                placeholder="Pergunta"
                value={asText(item.question)}
                onChange={(e) => updateFaqItem(index, "question", e.target.value)}
              />
              <textarea
                placeholder="Resposta"
                value={asText(item.answer)}
                onChange={(e) => updateFaqItem(index, "answer", e.target.value)}
              />
              <button type="button" className="pe4-faq-remove" onClick={() => removeFaqItem(index)}>Remover</button>
            </div>
          ))}
        </div>

        {editing && (
          <div className="pe4-faq">
            <div className="pe4-faq-head">
              <label>Ofertas extras no checkout (order bump)</label>
              <button type="button" className="pe4-faq-add" onClick={addBumpRow}>+ Adicionar oferta</button>
            </div>
            <span className="pe4-help">
              Produtos que aparecem no checkout DESTE produto com 1 clique, por um preço especial (não é o preço de tabela do produto escolhido).
            </span>
            {form.bumps.length === 0 && <span className="pe4-help">Nenhuma oferta extra cadastrada ainda.</span>}
            {form.bumps.map((row, index) => (
              <div className="pe4-faq-item" key={index}>
                <select value={row.bump_product_id} onChange={(e) => updateBumpRow(index, "bump_product_id", e.target.value)}>
                  <option value="">Escolha o produto...</option>
                  {catalog.filter((item) => item.id !== id).map((item) => (
                    <option key={item.id} value={item.id}>{item.title}{item.status !== "active" && item.status !== "unlisted" ? ` (${item.status})` : ""}</option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  placeholder="Preço especial, ex.: 97,00"
                  value={row.price_reais}
                  onChange={(e) => updateBumpRow(index, "price_reais", e.target.value)}
                />
                <button type="button" className="pe4-faq-remove" onClick={() => removeBumpRow(index)}>Remover</button>
              </div>
            ))}
          </div>
        )}

        <div className="pe4-actions"><button className="pe4-save" type="submit" disabled={saving}>{saving ? "Salvando no banco..." : "Salvar alterações"}</button><button className="pe4-cancel" type="button" onClick={() => navigate("/admin/produtos")}>Cancelar</button></div>
      </form>

      {editing && saved && saved.slug && <ProductLinks product={saved} />}
    </section>
  );
}
