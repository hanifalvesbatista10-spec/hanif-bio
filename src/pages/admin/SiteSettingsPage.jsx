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
  ["about_title", "Título da seção Sobre"],
  ["about_text", "Texto da seção Sobre"],
  ["whatsapp_url", "Link do WhatsApp"],
  ["instagram_url", "Link do Instagram"],
  ["footer_description", "Descrição do rodapé"],
  ["footer_disclaimer", "Aviso legal do rodapé"],
  ["copyright_text", "Copyright"],
];

export default function SiteSettingsPage() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) setMessage(`Erro ao carregar: ${error.message}`);
      else setForm(data || { id: 1 });
      setLoading(false);
    };

    load();
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = { ...form, id: 1 };
    const { error } = await supabase
      .from("site_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) setMessage(`Erro ao salvar: ${error.message}`);
    else setMessage("Site atualizado com sucesso. As alterações já estão disponíveis na página pública.");

    setSaving(false);
  };

  if (loading) return <section className="admin-section">Carregando configurações...</section>;

  return (
    <section className="admin-section">
      <style>{`
        .site-cms-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:24px}
        .site-cms-head span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.12em}
        .site-cms-head h2{margin:5px 0 0;color:#071426;font-size:2rem}.site-cms-head p{max-width:520px;margin:0;color:#66798c;line-height:1.6}
        .site-cms-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.site-cms-field{display:grid;gap:7px}.site-cms-field.full{grid-column:1/-1}.site-cms-field label{font-size:.79rem;font-weight:900;color:#2c4257}.site-cms-field input,.site-cms-field textarea{width:100%;padding:12px 13px;border:1px solid #d6e0e9;border-radius:11px;font:inherit;color:#12283d;background:#fff}.site-cms-field textarea{min-height:110px;resize:vertical}.site-cms-card{padding:24px;border:1px solid #e0e7ee;border-radius:20px;background:#fff;box-shadow:0 14px 40px rgba(7,20,38,.06)}.site-cms-actions{display:flex;justify-content:flex-end;margin-top:20px}.site-cms-save{min-height:50px;padding:0 22px;border:0;border-radius:12px;background:#d6152d;color:#fff;font-weight:900;cursor:pointer}.site-cms-save:disabled{opacity:.6}.site-cms-message{margin-bottom:16px;padding:13px 15px;border-radius:12px;background:#eef9f2;border:1px solid #cbe8d5;color:#236842;font-weight:800}
        @media(max-width:760px){.site-cms-head{align-items:start;flex-direction:column}.site-cms-grid{grid-template-columns:1fr}.site-cms-field.full{grid-column:auto}}
      `}</style>

      <div className="site-cms-head">
        <div>
          <span>CMS DO SITE</span>
          <h2>Conteúdo da página pública</h2>
        </div>
        <p>Altere a primeira impressão, contatos, textos institucionais e rodapé sem tocar no código.</p>
      </div>

      {message && <div className="site-cms-message">{message}</div>}

      <form className="site-cms-card" onSubmit={save}>
        <div className="site-cms-grid">
          {fields.map(([key, label]) => {
            const longField = [
              "hero_title",
              "hero_subtitle",
              "authority_line",
              "about_title",
              "about_text",
              "footer_description",
              "footer_disclaimer",
            ].includes(key);

            return (
              <div className={`site-cms-field ${longField ? "full" : ""}`} key={key}>
                <label htmlFor={key}>{label}</label>
                {longField ? (
                  <textarea
                    id={key}
                    value={form[key] || ""}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  />
                ) : (
                  <input
                    id={key}
                    value={form[key] || ""}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  />
                )}
              </div>
            );
          })}
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
