import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../services/supabase";
import PublicFeedbacks from "../../components/feedbacks/PublicFeedbacks";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import BrandIntro, { shouldPlayIntro } from "../../components/site/BrandIntro";
import Hero from "../../components/sections/Hero";
import ExpertiseStrip from "../../components/sections/ExpertiseStrip";
import Positioning from "../../components/sections/Positioning";
import FeaturedProduct from "../../components/sections/FeaturedProduct";
import ProductEcosystem from "../../components/sections/ProductEcosystem";
import Method from "../../components/sections/Method";
import ContentShowcase from "../../components/sections/ContentShowcase";
import Authority from "../../components/sections/Authority";
import FaqSection from "../../components/sections/FaqSection";
import FinalCta from "../../components/sections/FinalCta";
import "./ConversionHomePage.css";
import "../../styles/home.css";

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

export default function ConversionHomePage() {
  const [settings, setSettings] = useState(fallbackSettings);
  // Enquanto os textos do admin não chegam, a copy do Hero fica oculta: assim o texto padrão nunca aparece para trocar depois.
  const [settingsReady, setSettingsReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [content, setContent] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playIntro] = useState(() => shouldPlayIntro());
  const [introActive, setIntroActive] = useState(playIntro);

  useEffect(() => {
    // Textos primeiro e em separado: o Hero aparece assim que eles chegam, sem esperar produtos e FAQ.
    const loadSettings = async () => {
      try {
        const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
        if (data) setSettings((current) => ({ ...current, ...data }));
      } finally {
        setSettingsReady(true);
      }
    };

    const load = async () => {
      const [productsResult, contentResult, faqResult] = await Promise.all([
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

    loadSettings();
    load();
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [location.hash]);

  // Hierarquia com o que já existe: a ordem do admin (destaque + display_order) define quem lidera.
  const [featured, ...others] = products;

  return (
    <div className={`site-page is-home ${introActive ? "is-intro-active" : ""}`}>
      {playIntro && <BrandIntro onFinish={() => setIntroActive(false)} />}
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />

      <Hero settings={settings} introActive={introActive} pending={!settingsReady} />

      <main>
        <ExpertiseStrip />
        <Positioning settings={settings} />

        <div id="produtos">
          {loading ? (
            <div className="hx-section hx-loading" role="status">Carregando formações...</div>
          ) : featured ? (
            <>
              <FeaturedProduct product={featured} settings={settings} />
              <ProductEcosystem products={others} settings={settings} />
            </>
          ) : (
            <div className="hx-section hx-loading">Novas formações serão publicadas em breve.</div>
          )}
        </div>

        <Method settings={settings} />

        <div id="depoimentos">
          <PublicFeedbacks limit={8} />
        </div>

        <ContentShowcase items={content} />
        <Authority settings={settings} />
        <FaqSection faqs={faqs} />
        <FinalCta settings={settings} />
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
