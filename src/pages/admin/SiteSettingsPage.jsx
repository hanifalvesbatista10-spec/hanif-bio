import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

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
    const { error } = await supabase
      .from("site_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      setMessageType("error");
      const isMissingColumn = error.message?.includes("column") && error.message?.includes("does not exist");
      setMessage(
        isMissingColumn
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
