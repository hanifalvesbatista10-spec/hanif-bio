import { getProductCheckout } from "../../services/productCheckout";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../services/supabase";
import PublicFeedbacks from "../../components/feedbacks/PublicFeedbacks";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import BrandIntro, { shouldPlayIntro } from "../../components/site/BrandIntro";
import HeroMedia from "../../components/site/HeroMedia";
import "./ConversionHomePage.css";

const fallbackSettings = {
  hero_kicker: "APH • URGÊNCIA • EMERGÊNCIA",
  hero_title: "Domine situações críticas antes que elas aconteçam.",
  hero_subtitle:
    "Treinamentos, materiais e mentorias para profissionais e estudantes que querem tomar decisões com mais segurança no atendimento pré-hospitalar.",
  hero_primary_label: "Conhecer treinamentos",
  hero_secondary_label: "Ver produtos",
  hero_image_url: "/assets/hanif-hero.png",
  authority_line:
    "10 anos na linha de frente • SAMU 192 • Instrutor APH • Conteúdo baseado em evidências",
  about_title:
    "Experiência de linha de frente transformada em ensino aplicável.",
  about_text:
    "Conteúdo direto, didático e conectado à realidade do atendimento pré-hospitalar.",
  whatsapp_url: "https://wa.me/5588993765491",
  instagram_url: "",
  footer_description:
    "Educação aplicada à tomada de decisão em situações críticas.",
  footer_disclaimer:
    "Conteúdo educacional. A aplicação prática deve respeitar protocolos, legislação e atribuições profissionais vigentes.",
  copyright_text: "© 2026 Hanif Alves. Todos os direitos reservados.",
  products_section_title: "Escolha o próximo passo da sua evolução profissional.",
  value_section_title: "Em uma emergência, confiança não pode depender de improviso.",
  professional_roles: [
    "Técnico de Enfermagem Socorrista",
    "Instrutor de APH",
    "Instrumentador Cirúrgico",
    "Analista de Dados",
  ],
  value_props: [
    {
      title: "Reconhecer rápido",
      text: "Organize o raciocínio para identificar prioridades sem perder tempo com o que não muda a conduta.",
    },
    {
      title: "Decidir com método",
      text: "Conecte avaliação, princípios e preferências para sustentar decisões mais consistentes.",
    },
    {
      title: "Treinar antes da pressão",
      text: "Construa repertório antes do atendimento real exigir resposta imediata.",
    },
  ],
};

function formatContentDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

function money(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "-40px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`site-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

export default function ConversionHomePage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [products, setProducts] = useState([]);
  const [content, setContent] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playIntro] = useState(() => shouldPlayIntro());
  const [introActive, setIntroActive] = useState(playIntro);

  useEffect(() => {
    const load = async () => {
      const [settingsResult, productsResult, contentResult, faqResult] = await Promise.all([
        supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
        supabase
          .from("products")
          .select("*")
          .eq("status", "active")
          .order("is_featured", { ascending: false })
          .order("display_order", { ascending: true }),
        supabase
          .from("site_content")
          .select("*")
          .eq("status", "published")
          .order("display_order", { ascending: true })
          .limit(3),
        supabase
          .from("site_faqs")
          .select("id,question,answer")
          .eq("status", "published")
          .order("display_order", { ascending: true }),
      ]);

      if (settingsResult.data) {
        setSettings((current) => ({ ...current, ...settingsResult.data }));
      }

      if (!productsResult.error) {
        setProducts(productsResult.data || []);
      }

      if (!contentResult.error) {
        setContent(contentResult.data || []);
      }

      if (!faqResult.error) {
        setFaqs(faqResult.data || []);
      }

      setLoading(false);
    };

    load();
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [location.hash]);

  return (
    <div className={`site-page ${introActive ? "is-intro-active" : ""}`}>
      {playIntro && <BrandIntro onFinish={() => setIntroActive(false)} />}
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />

      <section className="site-hero" id="top">
        <HeroMedia hold={introActive} alt="Hanif Alves, técnico de enfermagem socorrista e instrutor de APH, de braços cruzados" />
        <div className="site-hero-content">
          <div className="site-hero-inner">
            <div className="site-hero-copy">
              <span className="site-identity">SAMU 192 · Urgência e Emergência</span>
              <h1>{settings.hero_title}</h1>
              <p className="site-hero-subtitle">{settings.hero_subtitle}</p>

              <div className="site-hero-actions">
                <a className="site-btn primary" href="#produtos">
                  {settings.hero_primary_label}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="site-section alt" id="produtos">
          <div className="site-container">
            <Reveal>
              <div className="site-section-head">
                <div>
                  <h2>{settings.products_section_title}</h2>
                </div>
                <p>
                  Conteúdos objetivos para transformar conhecimento em decisão mais segura no atendimento.
                </p>
              </div>
            </Reveal>

            {loading ? (
              <div className="site-empty">Carregando produtos...</div>
            ) : products.length === 0 ? (
              <div className="site-empty">Novos produtos serão publicados em breve.</div>
            ) : (
              <div className="site-products">
                {products.map((product, index) => {
                  const currentPrice = product.promotional_price ?? product.price;
                  const isSpotlight = index === 0;
                  return (
                    <Reveal
                      key={product.id}
                      as="article"
                      delay={Math.min(index, 3) * 80}
                      className={isSpotlight ? "site-product is-spotlight" : "site-product"}
                    >
                      <div className="site-product-image">
                        {product.cover_url && (
                          <Link to={`/produto/${product.slug}`}>
                            <img
                              src={product.cover_url}
                              alt={product.title}
                              loading="lazy"
                              style={
                                product.slug === "mentoria-aph"
                                  ? { objectFit: "contain", background: "#07090c" }
                                  : undefined
                              }
                            />
                          </Link>
                        )}
                      </div>
                      <div className="site-product-body">
                        <span className="site-product-tag">
                          {product.category || "Formação"}
                        </span>
                        <h3><Link to={`/produto/${product.slug}`}>{product.title}</Link></h3>
                        <p>{product.short_description}</p>
                        {(product.duration || product.format || product.availability_status) && (
                          <div className="site-tag-row">
                            {product.duration && <span>{product.duration}</span>}
                            {product.format && <span>{product.format}</span>}
                            {product.availability_status && <span>{product.availability_status}</span>}
                          </div>
                        )}
                        {currentPrice !== null && currentPrice !== undefined && (
                          <div className="site-price">
                            <strong>{money(currentPrice)}</strong>
                            {product.promotional_price !== null &&
                              product.price !== null && <del>{money(product.price)}</del>}
                          </div>
                        )}
                        <div className="site-product-actions">
                          <Link className="site-detail" to={`/produto/${product.slug}`}>
                            Ver detalhes
                          </Link>
                          {product.slug === "mentoria-aph" ? (
                            <Link className="site-buy" to="/produto/mentoria-aph">
                              Conhecer a mentoria
                            </Link>
                          ) : (
                            <a
                              className="site-buy"
                              href={getProductCheckout(product) || product.whatsapp_url || settings.whatsapp_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Quero acessar agora
                            </a>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <Reveal>
              <div className="site-section-head">
                <div>
                  <h2>{settings.value_section_title}</h2>
                </div>
              </div>
            </Reveal>
            <div className="site-value-list">
              {settings.value_props.map((item, index) => (
                <Reveal key={item.title} delay={index * 90} className="site-value">
                  <span className="site-value-index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section alt" id="sobre">
          <div className="site-container site-about">
            <Reveal className="site-about-photo">
              <img src={settings.hero_image_url} alt="Hanif Alves, instrutor de APH" loading="lazy" />
            </Reveal>
            <Reveal delay={80} className="site-about-copy">
              <h2>{settings.about_title}</h2>
              <p className="site-credentials">{settings.professional_roles.join(" · ")}</p>
              <p>{settings.about_text}</p>
              <Link className="site-about-link" to="/sobre">Conhecer a trajetória completa</Link>
            </Reveal>
          </div>
        </section>

        {content.length > 0 && (
          <section className="site-section" id="conteudos">
            <div className="site-container">
              <Reveal>
                <div className="site-section-head">
                  <div>
                    <h2>Conteúdos e materiais gratuitos.</h2>
                  </div>
                  <p>Artigos e materiais para revisar e estudar sem custo.</p>
                </div>
              </Reveal>
              <div className="site-products">
                {content.map((item, index) => (
                  <Reveal key={item.id} as="article" delay={index * 80} className="site-product">
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
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        <div id="depoimentos">
          <PublicFeedbacks limit={6} />
        </div>

        {faqs.length > 0 && (
          <section className="site-section alt" id="faq">
            <div className="site-container">
              <Reveal>
                <div className="site-section-head">
                  <div>
                    <h2>Perguntas frequentes.</h2>
                  </div>
                </div>
              </Reveal>
              <div className="site-faq-list">
                {faqs.map((item) => (
                  <details className="site-faq-item" key={item.id}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="site-final">
          <div className="site-container site-final-inner">
            <Reveal>
              <h2>Seu próximo atendimento não precisa ser o primeiro momento em que você pensa no problema.</h2>
              <div className="site-final-actions">
                <a className="site-btn primary" href="#produtos">Ver produtos e treinamentos</a>
                {settings.whatsapp_url && (
                  <a className="site-btn secondary" href={settings.whatsapp_url} target="_blank" rel="noreferrer">
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
