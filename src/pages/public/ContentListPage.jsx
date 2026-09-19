import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import "./ConversionHomePage.css";

function formatContentDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

const fallbackSettings = {
  hero_primary_label: "Conhecer treinamentos",
  whatsapp_url: "https://wa.me/5588993765491",
  instagram_url: "",
  footer_description: "Educação aplicada à tomada de decisão em situações críticas.",
  footer_disclaimer:
    "Conteúdo educacional. A aplicação prática deve respeitar protocolos, legislação e atribuições profissionais vigentes.",
  copyright_text: "© 2026 Hanif Alves. Todos os direitos reservados.",
};

export default function ContentListPage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "Conteúdos e materiais gratuitos | Hanif Alves";

    Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("site_content")
        .select("*")
        .eq("status", "published")
        .order("content_type", { ascending: true })
        .order("display_order", { ascending: true }),
    ]).then(([settingsResult, contentResult]) => {
      if (settingsResult.data) setSettings((current) => ({ ...current, ...settingsResult.data }));
      setItems(contentResult.data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="site-page">
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />

      <section className="site-section alt" style={{ paddingTop: "calc(var(--header-h) + 40px)" }}>
        <div className="site-container">
          <div className="site-section-head">
            <div>
              <span className="site-eyebrow">CONTEÚDOS GRATUITOS</span>
              <h2>Artigos e materiais para revisar e estudar.</h2>
            </div>
          </div>

          {loading ? (
            <div className="site-empty">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="site-empty">Novos conteúdos serão publicados em breve.</div>
          ) : (
            <div className="site-products">
              {items.map((item) => (
                <article className="site-product" key={item.id}>
                  {item.cover_url && (
                    <div className="site-product-image">
                      <img src={item.cover_url} alt={item.title} loading="lazy" />
                    </div>
                  )}
                  <div className="site-product-body">
                    <span className="site-product-tag">
                      {item.category || (item.content_type === "material" ? "Material gratuito" : "Conteúdo gratuito")}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <div className="site-content-meta">
                      {formatContentDate(item.published_at)} · Hanif Alves
                    </div>
                    <div className="site-product-actions">
                      {item.content_type === "material" ? (
                        <a className="site-buy" href={item.download_url} target="_blank" rel="noreferrer" style={{ gridColumn: "1 / -1" }}>
                          Baixar material
                        </a>
                      ) : (
                        <Link className="site-buy" to={`/conteudos/${item.slug}`} style={{ gridColumn: "1 / -1" }}>
                          Ler conteúdo
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter settings={settings} />
    </div>
  );
}
