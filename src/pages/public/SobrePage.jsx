import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import "./ConversionHomePage.css";

const fallbackSettings = {
  hero_primary_label: "Conhecer treinamentos",
  about_title: "Experiência de linha de frente transformada em ensino aplicável.",
  about_text:
    "Conteúdo direto, didático e conectado à realidade do atendimento pré-hospitalar.",
  hero_image_url: "/assets/hanif-hero.png",
  whatsapp_url: "https://wa.me/5588993765491",
  instagram_url: "",
  footer_description: "Educação aplicada à tomada de decisão em situações críticas.",
  footer_disclaimer:
    "Conteúdo educacional. A aplicação prática deve respeitar protocolos, legislação e atribuições profissionais vigentes.",
  copyright_text: "© 2026 Hanif Alves. Todos os direitos reservados.",
  professional_roles: [
    "Técnico de Enfermagem Socorrista",
    "Instrutor de APH",
    "Instrumentador Cirúrgico",
    "Analista de Dados",
  ],
  about_areas: [
    {
      title: "Atuação prática em urgência e emergência",
      text: "Experiência real de linha de frente no atendimento pré-hospitalar, hoje traduzida em conteúdo didático e aplicável para quem estuda e atua na área.",
    },
    {
      title: "Formação como instrutor de APH",
      text: "Preparo de estudantes e profissionais da saúde para tomar decisões com mais segurança diante de situações críticas.",
    },
    {
      title: "Instrumentação cirúrgica e análise de dados",
      text: "Áreas de atuação complementares que reforçam o rigor técnico e a organização por trás de cada treinamento e material produzido.",
    },
  ],
};

export default function SobrePage() {
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "Sobre Hanif Alves | APH, Urgência e Emergência";
    supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings((current) => ({ ...current, ...data }));
      });
  }, []);

  return (
    <div className="site-page">
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />

      <section className="site-section alt" style={{ paddingTop: "calc(var(--header-h) + 40px)" }}>
        <div className="site-container site-about">
          <div className="site-about-photo">
            <img src={settings.hero_image_url} alt="Hanif Alves, instrutor de APH" />
          </div>
          <div className="site-about-copy">
            <span className="site-eyebrow">SOBRE HANIF ALVES</span>
            <h2>{settings.about_title}</h2>
            <p className="site-credentials">{settings.professional_roles.join(" · ")}</p>
            <p>{settings.about_text}</p>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="site-value-list">
            {settings.about_areas.map((area, index) => (
              <div className="site-value" key={area.title}>
                <span className="site-value-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{area.title}</strong>
                  <p>{area.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </div>
  );
}
