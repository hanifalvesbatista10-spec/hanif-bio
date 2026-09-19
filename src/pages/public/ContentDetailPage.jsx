import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

export default function ContentDetailPage() {
  const { slug } = useParams();
  const [settings, setSettings] = useState(fallbackSettings);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });

    Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("site_content")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle(),
    ]).then(([settingsResult, contentResult]) => {
      if (settingsResult.data) setSettings((current) => ({ ...current, ...settingsResult.data }));
      if (contentResult.error || !contentResult.data) {
        setNotFound(true);
      } else {
        setItem(contentResult.data);
        document.title = `${contentResult.data.meta_title || contentResult.data.title} | Hanif Alves`;
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <main className="site-empty" style={{ minHeight: "100vh" }}>Carregando...</main>;

  if (notFound || !item) {
    return (
      <div className="site-page">
        <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />
        <section className="site-section alt" style={{ paddingTop: "calc(var(--header-h) + 40px)", minHeight: "60vh" }}>
          <div className="site-container">
            <h2>Conteúdo não encontrado</h2>
            <p>Este conteúdo pode ter sido despublicado ou não existe mais.</p>
            <Link className="site-about-link" to="/conteudos">Ver todos os conteúdos</Link>
          </div>
        </section>
        <SiteFooter settings={settings} />
      </div>
    );
  }

  return (
    <div className="site-page">
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />

      <section className="site-section alt" style={{ paddingTop: "calc(var(--header-h) + 40px)" }}>
        <div className="site-container" style={{ maxWidth: 760, margin: "0 auto" }}>
          <Link className="site-about-link" to="/conteudos" style={{ marginBottom: 24 }}>← Ver todos os conteúdos</Link>
          <span className="site-eyebrow">{item.category || "CONTEÚDO GRATUITO"}</span>
          <h2 style={{ marginTop: 8 }}>{item.title}</h2>
          <div className="site-content-meta" style={{ marginTop: 8 }}>
            {formatContentDate(item.published_at)} · Hanif Alves
          </div>
          {item.cover_url && (
            <img
              src={item.cover_url}
              alt={item.title}
              style={{ width: "100%", borderRadius: 20, margin: "22px 0", objectFit: "cover", maxHeight: 420 }}
            />
          )}
          {item.summary && <p style={{ color: "var(--brand-text-soft)", fontSize: "1.1rem", lineHeight: 1.7 }}>{item.summary}</p>}
          {item.body && (
            <div style={{ color: "var(--brand-text-soft)", lineHeight: 1.8, whiteSpace: "pre-line", marginTop: 20 }}>
              {item.body}
            </div>
          )}
        </div>
      </section>

      <SiteFooter settings={settings} />
    </div>
  );
}
