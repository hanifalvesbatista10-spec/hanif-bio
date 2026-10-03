import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { BASIS_LABELS, POPULATION_LABELS, TOPIC_LABELS, TYPE_LABELS, formatDate, safeUrl } from "../../services/radar";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import "./ConversionHomePage.css";

const fallbackSettings = {
  hero_primary_label: "Conhecer treinamentos",
  whatsapp_url: "https://wa.me/5588993765491",
  instagram_url: "",
  footer_description: "Educação aplicada à tomada de decisão em situações críticas.",
  footer_disclaimer: "Conteúdo educacional. A aplicação prática deve respeitar protocolos, legislação e atribuições profissionais vigentes.",
  copyright_text: "© 2026 Hanif Alves. Todos os direitos reservados.",
};

// A página só recebe do banco o que está publicado e aprovado (RLS). Tudo é mostrado como TEXTO: nada de HTML.
function Section({ title, children }) {
  if (!children) return null;
  return (
    <section style={{ marginTop: 26 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>{title}</h3>
      <p style={{ margin: 0, color: "var(--brand-text-soft)", lineHeight: 1.75, whiteSpace: "pre-line" }}>{children}</p>
    </section>
  );
}

function Detail({ item }) {
  const refs = Array.isArray(item.references) ? item.references : [];
  return (
    <div className="site-container" style={{ maxWidth: 820 }}>
      <Link className="site-about-link" to="/radar">← Voltar ao Radar</Link>
      <span className="site-eyebrow" style={{ display: "block", marginTop: 18 }}>{TOPIC_LABELS[item.topic] || "Radar de Evidências"}</span>
      <h1 style={{ margin: "8px 0 14px", fontSize: "clamp(1.8rem,4vw,2.6rem)", lineHeight: 1.15 }}>{item.title_pt || item.title_original}</h1>
      <p className="site-content-meta" style={{ margin: 0 }}>
        {TYPE_LABELS[item.publication_type] || "Publicação"} · {POPULATION_LABELS[item.population] || "—"} · Publicado na fonte em {formatDate(item.published_date)}
        {item.updated_date ? ` · Atualizado em ${formatDate(item.updated_date)}` : ""}
      </p>
      <p style={{ margin: "10px 0 0", fontWeight: 700 }}>
        Revisado por {item.reviewer_name || "Hanif Alves"} em {formatDate(item.approved_at)}
      </p>

      <Section title="Resumo">{item.summary_pt}</Section>
      <Section title="Achado principal">{item.main_finding}</Section>
      <Section title="O que mudou">{item.what_changed}</Section>
      <Section title="Força da evidência">{item.evidence_strength}</Section>
      {item.official_grade && <Section title="Classificação oficial (copiada da fonte)">{item.official_grade}</Section>}
      <Section title="Limitações">{item.limitations}</Section>
      <Section title="Aplicabilidade ao APH brasileiro">{item.applicability_br}</Section>

      <p style={{ marginTop: 26, padding: 14, borderRadius: 12, background: "var(--brand-surface-alt, #f3f6f9)", color: "var(--brand-text-soft)", fontSize: ".9rem", lineHeight: 1.6 }}>
        {BASIS_LABELS[item.analysis_basis] || "Análise baseada no material público da fonte"}. As conclusões se limitam ao conteúdo consultado; para decidir
        qualquer conduta, leia a fonte original. Conteúdo educacional: não substitui protocolos, treinamento nem legislação vigentes.
      </p>

      <section style={{ marginTop: 26 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Referências</h3>
        <p style={{ margin: "0 0 6px", color: "var(--brand-text-soft)" }}>{item.title_original}{item.authors ? ` — ${item.authors}` : ""} ({item.source_name})</p>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
          {refs.filter((ref) => safeUrl(ref.url)).map((ref) => (
            <li key={ref.url}>
              <a href={safeUrl(ref.url)} target="_blank" rel="noopener noreferrer">{ref.label}{ref.pmid ? ` ${ref.pmid}` : ""}{ref.doi ? ` ${ref.doi}` : ""}</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function RadarPage() {
  const { id } = useParams();
  const [settings, setSettings] = useState(fallbackSettings);
  const [items, setItems] = useState([]);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "Radar de Evidências em APH | Hanif Alves";
    setLoading(true);
    let query = supabase.from("radar_items").select("*").eq("status", "published").order("published_at", { ascending: false });
    if (id) query = query.eq("id", id);
    Promise.all([supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(), query]).then(([settingsResult, itemsResult]) => {
      if (settingsResult.data) setSettings((current) => ({ ...current, ...settingsResult.data }));
      setItems(itemsResult.data || []);
      setLoading(false);
    });
  }, [id]);

  const visible = topic ? items.filter((item) => item.topic === topic) : items;

  return (
    <div className="site-page">
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />
      <section className="site-section alt" style={{ paddingTop: "calc(var(--header-h) + 40px)" }}>
        {loading ? (
          <div className="site-container"><div className="site-empty">Carregando...</div></div>
        ) : id ? (
          items[0] ? <Detail item={items[0]} /> : (
            <div className="site-container">
              <div className="site-empty">Esta análise não está disponível.</div>
              <Link className="site-about-link" to="/radar">← Voltar ao Radar</Link>
            </div>
          )
        ) : (
          <div className="site-container">
            <div className="site-section-head">
              <div>
                <span className="site-eyebrow">RADAR DE EVIDÊNCIAS</span>
                <h2>Novidades científicas em APH, revisadas por Hanif Alves.</h2>
              </div>
            </div>
            <p className="site-lead" style={{ maxWidth: 720 }}>
              Toda semana são monitoradas publicações sobre RCP e DEA, trauma e hemorragia, emergências pediátricas e neonatais e restrição de movimento da coluna.
              Cada item abaixo foi analisado e <strong>revisado antes de ser publicado</strong>, com as referências originais.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0 24px" }}>
              <button type="button" className={`site-chip ${topic === "" ? "is-active" : ""}`} onClick={() => setTopic("")} style={chipStyle(topic === "")}>Todos</button>
              {Object.entries(TOPIC_LABELS).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setTopic(key)} style={chipStyle(topic === key)}>{label}</button>
              ))}
            </div>
            {visible.length === 0 ? (
              <div className="site-empty">Novas análises serão publicadas em breve.</div>
            ) : (
              <div className="site-products">
                {visible.map((item) => (
                  <article className="site-product" key={item.id}>
                    <div className="site-product-body">
                      <span className="site-product-tag">{TOPIC_LABELS[item.topic] || "Radar"}</span>
                      <h3>{item.title_pt || item.title_original}</h3>
                      <p>{item.summary_pt}</p>
                      <div className="site-content-meta">
                        {TYPE_LABELS[item.publication_type] || "Publicação"} · {POPULATION_LABELS[item.population] || "—"} · {formatDate(item.published_date)}
                      </div>
                      <div className="site-content-meta">Revisado por {item.reviewer_name || "Hanif Alves"} em {formatDate(item.approved_at)}</div>
                      <div className="site-product-actions">
                        <Link className="site-buy" to={`/radar/${item.id}`} style={{ gridColumn: "1 / -1" }}>Ver análise e referências</Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
      <SiteFooter settings={settings} />
    </div>
  );
}

const chipStyle = (active) => ({
  padding: "8px 14px",
  borderRadius: 999,
  border: `1px solid ${active ? "var(--brand-red, #d6152d)" : "var(--brand-border, #d6e0e9)"}`,
  background: active ? "var(--brand-red, #d6152d)" : "transparent",
  color: active ? "#fff" : "inherit",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
});
