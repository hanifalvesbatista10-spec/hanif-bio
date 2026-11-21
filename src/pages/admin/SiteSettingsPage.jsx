import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { uploadFormImage } from "../../services/forms";
import { DEFAULT_MEDIA, DEFAULT_TEXT } from "../../components/cinematic/config";

// Abertura cinematográfica da home (site_settings.cinematic, SQL 65). Campo vazio = usa o padrão (mostrado como dica).
const CINE_TEXTS = [
  ["kicker", "Linha de marca acima do título"],
  ["title1", "Momento 1 · Título (é o título principal da página)"],
  ["support1", "Momento 1 · Apoio", "long"],
  ["primary_label", "Botão principal · Texto"],
  ["primary_href", "Botão principal · Destino (#produtos, /rota ou https://…)"],
  ["secondary_label", "Botão secundário · Texto"],
  ["secondary_href", "Botão secundário · Destino (em branco: página do produto de mentoria ativo)"],
  ["title2", "Momento 2 · Título"],
  ["support2", "Momento 2 · Apoio (opcional)", "long"],
  ["title3", "Momento 3 · Título"],
  ["support3", "Momento 3 · Apoio", "long"],
  ["title4", "Momento 4 · Título"],
  ["support4", "Momento 4 · Apoio (opcional)", "long"],
  ["cta4_label", "Momento 4 · Texto do botão"],
  ["cta4_href", "Momento 4 · Destino do botão"],
];

const CINE_IMAGES = [
  ["opening_desktop", "Cena de abertura · computador", DEFAULT_MEDIA.opening.desktop],
  ["opening_mobile", "Cena de abertura · celular (vertical)", DEFAULT_MEDIA.opening.mobile],
  ["prep_mobile", "Preparo · celular (vertical)", DEFAULT_MEDIA.prep.mobile],
  ["training_desktop", "Treinamento · computador", DEFAULT_MEDIA.training.desktop],
  ["training_mobile", "Treinamento · celular (vertical)", DEFAULT_MEDIA.training.mobile],
];

// Só guarda o que foi preenchido; tudo vazio vira nulo (a home usa o padrão).
function cleanCinematic(raw) {
  const out = {};
  Object.entries(raw || {}).forEach(([key, value]) => {
    if (key === "enabled") {
      if (value === false) out.enabled = false;
    } else if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  });
  return Object.keys(out).length ? out : null;
}

const fields = [
  ["hero_kicker", "Linha acima do título"],
  ["hero_title", "Título principal"],
  ["hero_subtitle", "Subtítulo principal"],
  ["hero_primary_label", "Texto do botão principal"],
  ["hero_secondary_label", "Texto do botão secundário"],
  ["hero_image_url", "Imagem principal (URL)"],
  ["authority_line", "Linha de autoridade"],
  ["products_section_title", "Título da seção Produtos"],
  ["value_section_title", "Título da seção \"Por que isso importa\""],
  ["about_title", "Título da seção Sobre"],
  ["about_text", "Texto da seção Sobre"],
  ["whatsapp_url", "Link do WhatsApp"],
  ["instagram_url", "Link do Instagram"],
  ["community_url", "Link do grupo da comunidade APH Hardcore (WhatsApp)"],
  ["contact_email", "E-mail de contato (aparece na política de privacidade)"],
  ["footer_description", "Descrição do rodapé"],
  ["footer_disclaimer", "Aviso legal do rodapé"],
  ["copyright_text", "Copyright"],
];

const longFields = [
  "hero_title",
  "hero_subtitle",
  "authority_line",
  "products_section_title",
  "value_section_title",
  "about_title",
  "about_text",
  "footer_description",
  "footer_disclaimer",
];

export default function SiteSettingsPage() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [cineTouched, setCineTouched] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        setMessageType("error");
        setMessage(`Erro ao carregar: ${error.message}`);
      } else {
        setForm({
          professional_roles: [],
          value_props: [],
          about_areas: [],
          ...(data || { id: 1 }),
        });
      }
      setLoading(false);
    };

    load();
  }, []);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const cine = form.cinematic && typeof form.cinematic === "object" ? form.cinematic : {};
  const setCine = (key, value) => {
    setCineTouched(true);
    setForm((current) => ({ ...current, cinematic: { ...(current.cinematic || {}), [key]: value } }));
  };
  const uploadCineImage = async (key, file) => {
    try {
      setCine(key, await uploadFormImage(file, "site"));
    } catch (uploadError) {
      setMessageType("error");
      setMessage(uploadError.message || "Não foi possível enviar a imagem.");
    }
  };

  const setRoleAt = (index, value) => {
    setForm((current) => {
      const next = (current.professional_roles || []).slice();
      next[index] = value;
      return { ...current, professional_roles: next };
    });
  };
  const addRole = () => setForm((current) => ({ ...current, professional_roles: [...(current.professional_roles || []), ""] }));
  const removeRole = (index) => setForm((current) => ({ ...current, professional_roles: (current.professional_roles || []).filter((_, i) => i !== index) }));

  const setListItemAt = (listKey, index, key, value) => {
    setForm((current) => {
      const next = (current[listKey] || []).slice();
      next[index] = { ...next[index], [key]: value };
      return { ...current, [listKey]: next };
    });
  };
  const addListItem = (listKey) => setForm((current) => ({ ...current, [listKey]: [...(current[listKey] || []), { title: "", text: "" }] }));
  const removeListItem = (listKey, index) => setForm((current) => ({ ...current, [listKey]: (current[listKey] || []).filter((_, i) => i !== index) }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setMessageType("success");

    const payload = { ...form, id: 1 };
    // a coluna da abertura (SQL 65) só vai no envio se ela existe no banco ou se a pessoa mexeu nela
    if ("cinematic" in form || cineTouched) payload.cinematic = cleanCinematic(form.cinematic);
    else delete payload.cinematic;
    const { error } = await supabase
      .from("site_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      setMessageType("error");
      const isMissingColumn = error.message?.includes("column") && error.message?.includes("does not exist");
      setMessage(
        isMissingColumn && /cinematic/i.test(error.message)
          ? "O banco ainda não tem os campos da abertura da home. Execute supabase/65_abertura_cinematografica.sql no SQL Editor e tente novamente."
          : isMissingColumn
          ? "O banco ainda não tem os campos novos. Execute supabase/10_conteudo_editavel_home_sobre.sql no SQL Editor e tente novamente."
          : `Erro ao salvar: ${error.message}`
      );
    } else {
      setMessage("Site atualizado com sucesso. As alterações já estão disponíveis na página pública.");
    }

    setSaving(false);
  };

  if (loading) return <section className="admin-section">Carregando configurações...</section>;

  return (
    <section className="admin-section">
      <style>{`
        .site-cms-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:24px}
        .site-cms-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.12em}
        .site-cms-head h2{margin:5px 0 0;color:#071426;font-size:2rem}.site-cms-head p{max-width:520px;margin:0;color:#66798c;line-height:1.6}
        .site-cms-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.site-cms-field{display:grid;gap:7px}.site-cms-field.full{grid-column:1/-1}.site-cms-field label{font-size:.79rem;font-weight:900;color:#2c4257}.site-cms-field input,.site-cms-field textarea{width:100%;padding:12px 13px;border:1px solid #d6e0e9;border-radius:11px;font:inherit;color:#12283d;background:#fff}.site-cms-field textarea{min-height:110px;resize:vertical}.site-cms-card{padding:24px;border:1px solid #e0e7ee;border-radius:20px;background:#fff;box-shadow:0 14px 40px rgba(7,20,38,.06)}.site-cms-actions{display:flex;justify-content:flex-end;margin-top:20px}.site-cms-save{min-height:50px;padding:0 22px;border:0;border-radius:12px;background:#d6152d;color:#fff;font-weight:900;cursor:pointer}.site-cms-save:disabled{opacity:.6}.site-cms-message{margin-bottom:16px;padding:13px 15px;border-radius:12px;background:#eef9f2;border:1px solid #cbe8d5;color:#236842;font-weight:800}.site-cms-message.error{background:#fff0f1;border-color:#f1c8cf;color:#a20e20}
        .site-cms-section{margin-top:30px;padding-top:26px;border-top:1px solid #e7edf2}.site-cms-section h3{margin:0 0 4px;color:#071426;font-size:1.2rem}.site-cms-section p{margin:0 0 16px;color:#66798c;font-size:.88rem}
        .site-cms-role-row{display:flex;gap:8px;margin-bottom:8px}.site-cms-role-row input{flex:1}
        .site-cms-list-item{padding:14px;border:1px solid #e7edf2;border-radius:14px;margin-bottom:10px;display:grid;gap:8px}
        .site-cms-remove{border:1px solid #f1bdc5;background:#fff5f6;color:#bb1730;border-radius:9px;padding:0 12px;font-weight:900;cursor:pointer}
        .site-cms-check{display:flex;gap:10px;align-items:flex-start;font-weight:800;color:#12283d;font-size:.92rem;cursor:pointer}.site-cms-check input{width:18px;height:18px;margin-top:2px;accent-color:#d6152d}
        .site-cms-add{border:1px solid #d6e0e9;background:#fff;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer;color:#12283d}
        @media(max-width:760px){.site-cms-head{align-items:start;flex-direction:column}.site-cms-grid{grid-template-columns:1fr}.site-cms-field.full{grid-column:auto}}
      `}</style>

      <div className="site-cms-head">
        <div>
          <span>CMS DO SITE</span>
          <h2>Conteúdo da página pública</h2>
        </div>
        <p>Altere a primeira impressão, contatos, textos institucionais e rodapé sem tocar no código.</p>
      </div>

      {message && <div className={`site-cms-message ${messageType === "error" ? "error" : ""}`}>{message}</div>}

      <form className="site-cms-card" onSubmit={save}>
        <div className="site-cms-grid">
          {fields.map(([key, label]) => {
            const longField = longFields.includes(key);

            return (
              <div className={`site-cms-field ${longField ? "full" : ""}`} key={key}>
                <label htmlFor={key}>{label}</label>
                {longField ? (
                  <textarea id={key} value={form[key] || ""} onChange={(event) => setField(key, event.target.value)} />
                ) : (
                  <input id={key} value={form[key] || ""} onChange={(event) => setField(key, event.target.value)} />
                )}
              </div>
            );
          })}
        </div>

        <div className="site-cms-section">
          <h3>Abertura da home (cena com rolagem)</h3>
          <p>
            Os quatro momentos que acompanham a rolagem no topo da página. Campo em branco usa o texto ou a imagem padrão (mostrado na dica do campo).
            Nos títulos, o trecho entre **asteriscos** sai em vermelho. Destinos: #produtos, uma rota do site (/sobre) ou um link https://.
          </p>
          <label className="site-cms-check">
            <input
              type="checkbox"
              checked={cine.enabled !== false}
              onChange={(event) => setCine("enabled", event.target.checked)}
            />
            Usar a abertura cinematográfica (desmarcado, a home volta à abertura simples)
          </label>
          <div className="site-cms-grid" style={{ marginTop: 14 }}>
            {CINE_TEXTS.map(([key, label, kind]) => (
              <div className={`site-cms-field ${kind === "long" ? "full" : ""}`} key={key}>
                <label htmlFor={`cine_${key}`}>{label}</label>
                {kind === "long" ? (
                  <textarea id={`cine_${key}`} rows={2} style={{ minHeight: 70 }} placeholder={DEFAULT_TEXT[key]} value={cine[key] || ""} onChange={(event) => setCine(key, event.target.value)} />
                ) : (
                  <input id={`cine_${key}`} placeholder={DEFAULT_TEXT[key]} value={cine[key] || ""} onChange={(event) => setCine(key, event.target.value)} />
                )}
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 22 }}>Imagens da abertura</h3>
          <p>JPG, PNG ou WebP de até 5 MB. As versões de celular são verticais (proporção 9:16, texto fica na parte de baixo). Em branco usa a imagem padrão.</p>
          <div className="site-cms-grid">
            {CINE_IMAGES.map(([key, label, fallback]) => (
              <div className="site-cms-field full" key={key}>
                <label htmlFor={`cine_${key}`}>{label}</label>
                <div className="site-cms-role-row">
                  <input id={`cine_${key}`} placeholder={fallback} value={cine[key] || ""} onChange={(event) => setCine(key, event.target.value)} />
                  <label className="site-cms-add" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    Enviar imagem
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadCineImage(key, file); }} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="site-cms-section">
          <h3>Cargos e formação (chips exibidos em Sobre)</h3>
          <p>Aparecem na seção Sobre da Home e na página /sobre.</p>
          {(form.professional_roles || []).map((role, index) => (
            <div className="site-cms-role-row" key={index}>
              <input value={role} onChange={(e) => setRoleAt(index, e.target.value)} />
              <button type="button" className="site-cms-remove" onClick={() => removeRole(index)}>Remover</button>
            </div>
          ))}
          <button type="button" className="site-cms-add" onClick={addRole}>+ Adicionar cargo</button>
        </div>

        <div className="site-cms-section">
          <h3>"Por que isso importa" (seção da Home)</h3>
          <p>Lista numerada exibida logo abaixo dos produtos.</p>
          {(form.value_props || []).map((item, index) => (
            <div className="site-cms-list-item" key={index}>
              <input placeholder="Título" value={item.title || ""} onChange={(e) => setListItemAt("value_props", index, "title", e.target.value)} />
              <textarea placeholder="Texto" rows={2} value={item.text || ""} onChange={(e) => setListItemAt("value_props", index, "text", e.target.value)} />
              <button type="button" className="site-cms-remove" style={{ justifySelf: "start" }} onClick={() => removeListItem("value_props", index)}>Remover</button>
            </div>
          ))}
          <button type="button" className="site-cms-add" onClick={() => addListItem("value_props")}>+ Adicionar item</button>
        </div>

        <div className="site-cms-section">
          <h3>Áreas de atuação (página Sobre)</h3>
          <p>Lista numerada exibida na página /sobre.</p>
          {(form.about_areas || []).map((item, index) => (
            <div className="site-cms-list-item" key={index}>
              <input placeholder="Título" value={item.title || ""} onChange={(e) => setListItemAt("about_areas", index, "title", e.target.value)} />
              <textarea placeholder="Texto" rows={2} value={item.text || ""} onChange={(e) => setListItemAt("about_areas", index, "text", e.target.value)} />
              <button type="button" className="site-cms-remove" style={{ justifySelf: "start" }} onClick={() => removeListItem("about_areas", index)}>Remover</button>
            </div>
          ))}
          <button type="button" className="site-cms-add" onClick={() => addListItem("about_areas")}>+ Adicionar item</button>
        </div>

        <div className="site-cms-actions">
          <button className="site-cms-save" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações do site"}
          </button>
        </div>
      </form>
    </section>
  );
}
