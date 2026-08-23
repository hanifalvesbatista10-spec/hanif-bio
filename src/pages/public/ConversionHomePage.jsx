import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import PublicFeedbacks from "../../components/feedbacks/PublicFeedbacks";

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
};

function money(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function ConversionHomePage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [settingsResult, productsResult] = await Promise.all([
        supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
        supabase
          .from("products")
          .select(
            "id,title,slug,short_description,cover_url,category,price,promotional_price,checkout_url,is_featured,display_order"
          )
          .eq("status", "active")
          .order("is_featured", { ascending: false })
          .order("display_order", { ascending: true }),
      ]);

      if (settingsResult.data) {
        setSettings((current) => ({ ...current, ...settingsResult.data }));
      }

      if (!productsResult.error) {
        setProducts(productsResult.data || []);
      }

      setLoading(false);
    };

    load();
  }, []);

  return (
    <div className="v4-page">
      <style>{`
        :root{--v4-navy:#071426;--v4-navy2:#0d2238;--v4-red:#d6152d;--v4-cream:#f7f9fb;--v4-text:#53677b}
        .v4-page{min-height:100vh;background:#fff;color:var(--v4-navy);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .v4-container{width:min(1180px,calc(100% - 34px));margin:0 auto}
        .v4-header{position:sticky;top:0;z-index:40;background:rgba(7,20,38,.94);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.08)}
        .v4-header-inner{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:22px}
        .v4-brand{color:#fff;text-decoration:none;font-weight:950;letter-spacing:.02em}.v4-brand span{display:block;color:#9fb1c2;font-size:.66rem;letter-spacing:.15em;margin-top:3px}
        .v4-nav{display:flex;align-items:center;gap:22px}.v4-nav a{color:#d9e1e8;text-decoration:none;font-size:.88rem;font-weight:800}.v4-nav .v4-nav-cta{padding:11px 15px;border-radius:10px;background:var(--v4-red);color:#fff}
        .v4-hero{position:relative;overflow:hidden;background:radial-gradient(circle at 75% 15%,rgba(214,21,45,.22),transparent 30%),linear-gradient(135deg,#071426 0%,#0b2137 100%);color:#fff;padding:72px 0 34px}
        .v4-hero-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:52px;align-items:center}
        .v4-kicker{display:inline-flex;padding:7px 10px;border-radius:999px;background:rgba(214,21,45,.14);border:1px solid rgba(255,84,105,.34);color:#ff9aaa;font-size:.7rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
        .v4-hero h1{margin:18px 0 18px;font-size:clamp(3rem,7vw,6.6rem);line-height:.94;letter-spacing:-.06em;max-width:850px}
        .v4-hero-copy{margin:0;max-width:700px;color:#c3d0dc;font-size:clamp(1.05rem,1.7vw,1.24rem);line-height:1.7}
        .v4-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.v4-btn{min-height:52px;padding:0 20px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-weight:950;border:1px solid transparent;cursor:pointer}.v4-btn.primary{background:var(--v4-red);color:#fff;box-shadow:0 16px 40px rgba(214,21,45,.26)}.v4-btn.secondary{border-color:rgba(255,255,255,.2);color:#fff;background:rgba(255,255,255,.04)}
        .v4-hero-visual{position:relative;min-height:520px;display:flex;align-items:flex-end;justify-content:center}.v4-hero-visual:before{content:"";position:absolute;inset:12% 8% 6%;border-radius:36px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.1)}.v4-hero-visual img{position:relative;z-index:2;width:100%;max-height:570px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 30px 55px rgba(0,0,0,.35))}
        .v4-authority{background:#fff;border-bottom:1px solid #e8edf2}.v4-authority-inner{min-height:86px;display:flex;align-items:center;justify-content:center;text-align:center;color:#263d54;font-size:.86rem;font-weight:900;letter-spacing:.03em}
        .v4-section{padding:92px 0}.v4-section.alt{background:var(--v4-cream)}
        .v4-section-head{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:34px}.v4-eyebrow{color:var(--v4-red);font-size:.72rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.v4-section h2{margin:8px 0 0;font-size:clamp(2.2rem,4.7vw,4.1rem);line-height:1.02;letter-spacing:-.045em;max-width:780px}.v4-section-head p{max-width:430px;color:var(--v4-text);line-height:1.7;margin:0}
        .v4-products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.v4-product{display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:#fff;border:1px solid #e4e9ee;box-shadow:0 18px 55px rgba(7,20,38,.08)}.v4-product-image{aspect-ratio:16/10;background:#e7edf3;overflow:hidden}.v4-product-image img{width:100%;height:100%;object-fit:cover}.v4-product-body{display:flex;flex:1;flex-direction:column;padding:23px}.v4-product-tag{color:var(--v4-red);font-size:.66rem;font-weight:950;letter-spacing:.11em;text-transform:uppercase}.v4-product h3{margin:8px 0 9px;font-size:1.28rem;line-height:1.25}.v4-product p{margin:0;color:var(--v4-text);line-height:1.6;font-size:.91rem;flex:1}.v4-price{display:flex;align-items:baseline;gap:8px;margin-top:16px}.v4-price strong{font-size:1.35rem}.v4-price del{color:#8b99a6;font-size:.8rem}.v4-product-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:9px;margin-top:18px}.v4-product-actions a{min-height:47px;display:flex;align-items:center;justify-content:center;border-radius:11px;text-decoration:none;font-weight:950;font-size:.86rem}.v4-detail{border:1px solid #d9e1e9;color:#243a50}.v4-buy{background:var(--v4-red);color:#fff}
        .v4-value-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.v4-value{padding:28px;border-radius:20px;background:#fff;border:1px solid #e3e9ef}.v4-value strong{display:block;font-size:1.12rem;margin-bottom:8px}.v4-value p{margin:0;color:var(--v4-text);line-height:1.65}
        .v4-about{display:grid;grid-template-columns:.78fr 1.22fr;gap:38px;align-items:center}.v4-about-card{min-height:420px;border-radius:24px;background:linear-gradient(135deg,#071426,#18344f);overflow:hidden;display:flex;align-items:flex-end;justify-content:center}.v4-about-card img{width:100%;height:100%;object-fit:contain;object-position:center bottom}.v4-about-copy p{color:var(--v4-text);font-size:1.06rem;line-height:1.8}.v4-about-list{display:grid;gap:12px;margin-top:24px}.v4-about-list div{padding:14px 16px;border-radius:12px;background:#f4f7fa;font-weight:850;color:#2c4359}
        .v4-final{padding:78px 0;background:linear-gradient(135deg,#d6152d,#a90921);color:#fff;text-align:center}.v4-final h2{margin:0 auto 14px;max-width:850px;font-size:clamp(2.4rem,5vw,4.5rem);line-height:1;letter-spacing:-.04em}.v4-final p{max-width:700px;margin:0 auto 24px;color:#ffe2e7;line-height:1.7}.v4-final .v4-btn{background:#fff;color:#a90921}
        .v4-footer{background:#050d17;color:#fff;padding:66px 0 24px}.v4-footer-grid{display:grid;grid-template-columns:1.25fr .8fr .8fr .9fr;gap:42px}.v4-footer h3,.v4-footer h4{margin:0 0 13px}.v4-footer p{color:#96a8b9;line-height:1.7;margin:0}.v4-footer a{display:block;color:#c9d3dc;text-decoration:none;margin:9px 0;font-size:.88rem}.v4-footer-note{margin-top:42px;padding-top:22px;border-top:1px solid rgba(255,255,255,.09);display:flex;justify-content:space-between;gap:20px;color:#718395;font-size:.75rem}.v4-footer-note a{display:inline;margin:0;color:#718395}.v4-empty{padding:35px;text-align:center;border:1px dashed #cad4de;border-radius:18px;color:#6e7f8f}
        @media(max-width:950px){.v4-hero-grid,.v4-about{grid-template-columns:1fr}.v4-hero-visual{min-height:390px}.v4-products,.v4-value-grid{grid-template-columns:repeat(2,1fr)}.v4-footer-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:650px){.v4-header-inner{min-height:68px}.v4-nav a:not(.v4-nav-cta){display:none}.v4-hero{padding-top:48px}.v4-hero h1{font-size:3.25rem}.v4-hero-visual{min-height:320px}.v4-section{padding:68px 0}.v4-section-head{align-items:start;flex-direction:column}.v4-products,.v4-value-grid,.v4-footer-grid{grid-template-columns:1fr}.v4-product-actions{grid-template-columns:1fr}.v4-footer-note{flex-direction:column}.v4-authority-inner{padding:18px 0}.v4-about-card{min-height:330px}}
      `}</style>

      <header className="v4-header">
        <div className="v4-container v4-header-inner">
          <a className="v4-brand" href="#top">
            HANIF ALVES
            <span>APH • URGÊNCIA • EMERGÊNCIA</span>
          </a>
          <nav className="v4-nav">
            <a href="#produtos">Produtos</a>
            <a href="#sobre">Sobre</a>
            <a href="#depoimentos">Depoimentos</a>
            <a className="v4-nav-cta" href="#produtos">Ver treinamentos</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="v4-hero">
          <div className="v4-container v4-hero-grid">
            <div>
              <span className="v4-kicker">{settings.hero_kicker}</span>
              <h1>{settings.hero_title}</h1>
              <p className="v4-hero-copy">{settings.hero_subtitle}</p>
              <div className="v4-hero-actions">
                <a className="v4-btn primary" href="#produtos">
                  {settings.hero_primary_label}
                </a>
                <a className="v4-btn secondary" href="#sobre">
                  {settings.hero_secondary_label}
                </a>
              </div>
            </div>
            <div className="v4-hero-visual">
              <img src={settings.hero_image_url} alt="Hanif Alves" />
            </div>
          </div>
        </section>

        <section className="v4-authority">
          <div className="v4-container v4-authority-inner">
            {settings.authority_line}
          </div>
        </section>

        <section className="v4-section alt" id="produtos">
          <div className="v4-container">
            <div className="v4-section-head">
              <div>
                <span className="v4-eyebrow">TREINAMENTOS E PRODUTOS</span>
                <h2>Escolha o próximo passo da sua evolução profissional.</h2>
              </div>
              <p>
                Conteúdos objetivos para transformar conhecimento em decisão mais segura no atendimento.
              </p>
            </div>

            {loading ? (
              <div className="v4-empty">Carregando produtos...</div>
            ) : products.length === 0 ? (
              <div className="v4-empty">Novos produtos serão publicados em breve.</div>
            ) : (
              <div className="v4-products">
                {products.map((product) => {
                  const currentPrice =
                    product.promotional_price ?? product.price;
                  return (
                    <article className="v4-product" key={product.id}>
                      <div className="v4-product-image">
                        {product.cover_url && (
                          <img src={product.cover_url} alt={product.title} loading="lazy" />
                        )}
                      </div>
                      <div className="v4-product-body">
                        <span className="v4-product-tag">
                          {product.category || "Formação"}
                        </span>
                        <h3>{product.title}</h3>
                        <p>{product.short_description}</p>
                        {currentPrice !== null && currentPrice !== undefined && (
                          <div className="v4-price">
                            <strong>{money(currentPrice)}</strong>
                            {product.promotional_price !== null &&
                              product.price !== null && <del>{money(product.price)}</del>}
                          </div>
                        )}
                        <div className="v4-product-actions">
                          <Link className="v4-detail" to={`/produto/${product.slug}`}>
                            Ver detalhes
                          </Link>
                          <a
                            className="v4-buy"
                            href={product.checkout_url || product.whatsapp_url || settings.whatsapp_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Quero acessar agora
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="v4-section">
          <div className="v4-container">
            <div className="v4-section-head">
              <div>
                <span className="v4-eyebrow">POR QUE ISSO IMPORTA</span>
                <h2>Em uma emergência, confiança não pode depender de improviso.</h2>
              </div>
            </div>
            <div className="v4-value-grid">
              <article className="v4-value"><strong>Reconhecer rápido</strong><p>Organize o raciocínio para identificar prioridades sem perder tempo com o que não muda a conduta.</p></article>
              <article className="v4-value"><strong>Decidir com método</strong><p>Conecte avaliação, princípios e preferências para sustentar decisões mais consistentes.</p></article>
              <article className="v4-value"><strong>Treinar antes da pressão</strong><p>Construa repertório antes do atendimento real exigir resposta imediata.</p></article>
            </div>
          </div>
        </section>

        <section className="v4-section alt" id="sobre">
          <div className="v4-container v4-about">
            <div className="v4-about-card">
              <img src={settings.hero_image_url} alt="Hanif Alves, instrutor de APH" loading="lazy" />
            </div>
            <div className="v4-about-copy">
              <span className="v4-eyebrow">SOBRE O INSTRUTOR</span>
              <h2>{settings.about_title}</h2>
              <p>{settings.about_text}</p>
              <div className="v4-about-list">
                <div>Experiência prática em urgência e emergência</div>
                <div>Didática voltada para aplicação e tomada de decisão</div>
                <div>Conteúdo alinhado a referências e evidências atuais</div>
              </div>
            </div>
          </div>
        </section>

        <div id="depoimentos">
          <PublicFeedbacks limit={6} />
        </div>

        <section className="v4-final">
          <div className="v4-container">
            <h2>Seu próximo atendimento não precisa ser o primeiro momento em que você pensa no problema.</h2>
            <p>Escolha um treinamento, aprofunde sua base e chegue mais preparado para decidir sob pressão.</p>
            <a className="v4-btn" href="#produtos">Ver produtos e treinamentos</a>
          </div>
        </section>
      </main>

      <footer className="v4-footer">
        <div className="v4-container">
          <div className="v4-footer-grid">
            <div>
              <h3>HANIF ALVES</h3>
              <p>{settings.footer_description}</p>
            </div>
            <div>
              <h4>Navegação</h4>
              <a href="#top">Início</a>
              <a href="#produtos">Produtos</a>
              <a href="#sobre">Sobre</a>
              <a href="#depoimentos">Depoimentos</a>
            </div>
            <div>
              <h4>Contato</h4>
              {settings.whatsapp_url && <a href={settings.whatsapp_url} target="_blank" rel="noreferrer">WhatsApp</a>}
              {settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}
            </div>
            <div>
              <h4>Administração</h4>
              <Link to="/admin/login">Acesso administrativo</Link>
              <p style={{marginTop:12}}>{settings.footer_disclaimer}</p>
            </div>
          </div>
          <div className="v4-footer-note">
            <span>{settings.copyright_text}</span>
            <span>Site profissional • Produtos direcionados para checkout externo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
