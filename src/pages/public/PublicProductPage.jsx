import { checkoutLinkProps, getProductCheckout, usesInternalCheckout } from "../../services/productCheckout";
import { useLessonCounts } from "../../services/productStats";
import Installments from "../../components/ui/Installments";
import { DiscountBadge, ProductHighlights } from "../../components/ui/ProductHighlights";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import "./ConversionHomePage.css";

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function CheckoutButton({ href, children, className = "" }) {
  return (
    <a
      className={`hem-cta ${className}`}
      href={href}
      {...checkoutLinkProps(href)}
    >
      {children}
    </a>
  );
}

function HemorrhageLanding({ product }) {
  const currentPrice = product.promotional_price ?? product.price;
  const checkout = getProductCheckout(product) || "#";

  return (
    <div className="hem-page">
      <style>{`
        :root{--hem-navy:#061426;--hem-navy2:#0d2239;--hem-red:#d6152d;--hem-red2:#af0e25;--hem-light:#f5f7fa;--hem-text:#53677b;--hem-line:#dde5ec}
        *{box-sizing:border-box}.hem-page{min-height:100vh;background:#fff;color:var(--hem-navy);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.hem-container{width:min(1160px,calc(100% - 32px));margin:0 auto}.hem-topbar{position:sticky;top:0;z-index:50;background:rgba(6,20,38,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.08)}.hem-topbar-inner{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}.hem-brand{color:#fff;text-decoration:none;font-weight:950}.hem-brand small{display:block;color:#95a8ba;font-size:.64rem;letter-spacing:.14em;margin-top:2px}.hem-mini-cta{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border-radius:10px;background:var(--hem-red);color:#fff;text-decoration:none;font-size:.84rem;font-weight:950}
        .hem-hero{overflow:hidden;background:radial-gradient(circle at 82% 18%,rgba(214,21,45,.24),transparent 27%),linear-gradient(135deg,#061426,#0d2239 68%,#101c2c);color:#fff;padding:76px 0 64px}.hem-hero-grid{display:grid;grid-template-columns:1.04fr .96fr;gap:52px;align-items:center}.hem-kicker{display:inline-flex;padding:7px 10px;border-radius:999px;border:1px solid rgba(255,113,130,.36);background:rgba(214,21,45,.12);color:#ff9aaa;font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.hem-hero h1{margin:18px 0 18px;font-size:clamp(3rem,6.4vw,5.8rem);line-height:.95;letter-spacing:-.055em}.hem-hero-copy{margin:0;color:#c6d2dd;line-height:1.75;font-size:clamp(1rem,1.6vw,1.18rem);max-width:700px}.hem-hero-points{display:grid;gap:10px;margin:24px 0 0;padding:0;list-style:none}.hem-hero-points li{display:flex;gap:10px;color:#eef4f8;font-weight:750}.hem-hero-points li:before{content:"✓";color:#ff7182;font-weight:950}.hem-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:28px}.hem-cta{min-height:54px;padding:0 22px;border-radius:12px;background:var(--hem-red);color:#fff;text-decoration:none;font-weight:950;display:inline-flex;align-items:center;justify-content:center;text-align:center;box-shadow:0 16px 38px rgba(214,21,45,.24)}.hem-cta:hover{background:var(--hem-red2)}.hem-cta.secondary{background:transparent;border:1px solid rgba(255,255,255,.22);box-shadow:none}.hem-hero-card{padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:26px;background:rgba(255,255,255,.055);box-shadow:0 30px 75px rgba(0,0,0,.28)}.hem-cover{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;background:#132a40}.hem-offer{padding:20px 5px 4px}.hem-offer small{display:block;color:#95a8b9;font-weight:850;text-transform:uppercase;letter-spacing:.09em}.hem-price{display:flex;gap:10px;align-items:baseline;margin:7px 0 15px}.hem-price strong{font-size:2rem}.hem-price del{color:#96a6b5}.hem-offer .hem-cta{width:100%}
        .hem-strip{border-bottom:1px solid var(--hem-line);background:#fff}.hem-strip-inner{min-height:82px;display:grid;grid-template-columns:repeat(3,1fr);align-items:center;text-align:center}.hem-strip-item{padding:16px;border-right:1px solid var(--hem-line);font-size:.84rem;font-weight:900;color:#2d4358}.hem-strip-item:last-child{border-right:0}
        .hem-section{padding:86px 0}.hem-section.alt{background:var(--hem-light)}.hem-eyebrow{color:var(--hem-red);font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.hem-section h2{margin:8px 0 18px;font-size:clamp(2.2rem,4.5vw,4rem);line-height:1.02;letter-spacing:-.045em;max-width:880px}.hem-lead{max-width:780px;color:var(--hem-text);line-height:1.8;font-size:1.06rem}.hem-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:34px}.hem-card{padding:28px;border:1px solid var(--hem-line);border-radius:20px;background:#fff;box-shadow:0 14px 42px rgba(7,20,38,.06)}.hem-card b{display:block;margin-bottom:9px;font-size:1.08rem}.hem-card p{margin:0;color:var(--hem-text);line-height:1.7}.hem-number{width:36px;height:36px;border-radius:10px;background:#fdecef;color:var(--hem-red);display:grid;place-items:center;font-weight:950;margin-bottom:14px}
        .hem-problem{display:grid;grid-template-columns:.9fr 1.1fr;gap:46px;align-items:center}.hem-dark-card{padding:36px;border-radius:24px;background:linear-gradient(145deg,#071426,#112b44);color:#fff}.hem-dark-card h3{margin:0 0 14px;font-size:1.8rem}.hem-dark-card p{color:#bdcad5;line-height:1.75}.hem-checklist{display:grid;gap:12px;margin-top:20px}.hem-check{display:flex;gap:11px;align-items:flex-start;padding:14px 15px;border-radius:12px;background:#f7f9fb;border:1px solid #e5ebf0;color:#30475d;font-weight:800}.hem-check:before{content:"✓";color:var(--hem-red);font-weight:950}
        .hem-midcta{padding:56px 0;background:linear-gradient(135deg,var(--hem-red),#a60b21);color:#fff;text-align:center}.hem-midcta h2{margin:0 auto 14px;font-size:clamp(2rem,4vw,3.6rem);max-width:850px;letter-spacing:-.035em}.hem-midcta p{margin:0 auto 22px;max-width:700px;color:#ffe2e7;line-height:1.7}.hem-midcta .hem-cta{background:#fff;color:#a60b21;box-shadow:none}
        .hem-product{display:grid;grid-template-columns:.78fr 1.22fr;gap:42px;align-items:start}.hem-product-image{width:100%;border-radius:22px;box-shadow:0 25px 60px rgba(7,20,38,.16)}.hem-product-copy{padding-top:8px}.hem-product-copy .hem-full{color:var(--hem-text);line-height:1.85;white-space:pre-line;margin:18px 0}.hem-buybox{margin-top:24px;padding:22px;border:1px solid var(--hem-line);border-radius:18px;background:#fff;box-shadow:0 16px 48px rgba(7,20,38,.08)}.hem-buybox .hem-price strong{color:var(--hem-navy)}.hem-buybox .hem-cta{width:100%}.hem-buybox-note{text-align:center;margin:10px 0 0;color:#718397;font-size:.78rem}
        .hem-faq{display:grid;gap:12px;margin-top:30px}.hem-faq details{border:1px solid var(--hem-line);border-radius:15px;background:#fff;padding:18px 20px}.hem-faq summary{cursor:pointer;font-weight:900;color:#183047}.hem-faq p{color:var(--hem-text);line-height:1.7;margin:12px 0 0}.hem-final{padding:78px 0;background:#071426;color:#fff;text-align:center}.hem-final h2{font-size:clamp(2.4rem,5vw,4.5rem);line-height:1;letter-spacing:-.045em;margin:0 auto 16px;max-width:900px}.hem-final p{max-width:700px;margin:0 auto 25px;color:#bdcad5;line-height:1.7}.hem-footer{padding:30px 0 90px;background:#050d17;color:#8496a7;text-align:center;font-size:.78rem}.hem-footer a{color:#c9d4dd}.hem-mobile-buy{display:none}
        @media(max-width:900px){.hem-hero-grid,.hem-problem,.hem-product{grid-template-columns:1fr}.hem-grid3{grid-template-columns:1fr 1fr}.hem-hero-card{max-width:650px}.hem-strip-inner{grid-template-columns:1fr}.hem-strip-item{border-right:0;border-bottom:1px solid var(--hem-line)}.hem-strip-item:last-child{border-bottom:0}}
        @media(max-width:640px){.hem-topbar-inner{min-height:64px}.hem-mini-cta{display:none}.hem-hero{padding:48px 0 42px}.hem-hero h1{font-size:3.15rem}.hem-grid3{grid-template-columns:1fr}.hem-section{padding:64px 0}.hem-actions{display:grid}.hem-cta{width:100%}.hem-mobile-buy{display:block;position:fixed;left:12px;right:12px;bottom:12px;z-index:80}.hem-mobile-buy .hem-cta{box-shadow:0 12px 36px rgba(0,0,0,.28)}.hem-footer{padding-bottom:100px}}
      `}</style>

      <header className="hem-topbar">
        <div className="hem-container hem-topbar-inner">
          <Link className="hem-brand" to="/">
            HANIF ALVES
            <small>APH • URGÊNCIA • EMERGÊNCIA</small>
          </Link>
          <a className="hem-mini-cta" href={checkout} {...checkoutLinkProps(checkout)}>Comprar agora</a>
        </div>
      </header>

      <main>
        <section className="hem-hero">
          <div className="hem-container hem-hero-grid">
            <div>
              <span className="hem-kicker">CONTROLE DE HEMORRAGIAS</span>
              <h1>Quando cada segundo importa, improviso não é estratégia.</h1>
              <p className="hem-hero-copy">
                Um material direto para quem quer organizar o raciocínio, revisar princípios essenciais e compreender melhor a abordagem inicial do controle de hemorragias no atendimento pré-hospitalar.
              </p>
              <ul className="hem-hero-points">
                <li>Conteúdo objetivo e pensado para consulta e revisão.</li>
                <li>Foco em tomada de decisão e prioridades no atendimento.</li>
                <li>Material educacional para estudantes e profissionais da saúde.</li>
              </ul>
              <div className="hem-actions">
                <CheckoutButton href={checkout}>Quero adquirir agora</CheckoutButton>
                <a className="hem-cta secondary" href="#conteudo">Ver o que vou encontrar</a>
              </div>
            </div>

            <aside className="hem-hero-card">
              {product.cover_url && <img className="hem-cover" src={product.cover_url} alt={`Capa de ${product.title}`} />}
              <div className="hem-offer">
                <small>Acesso ao material</small>
                {currentPrice !== null && currentPrice !== undefined && (
                  <div className="hem-price">
                    <strong>{formatPrice(currentPrice)}</strong>
                    {product.promotional_price !== null && product.price !== null && <del>{formatPrice(product.price)}</del>}
                  </div>
                )}
                <Installments product={product} tone="dark" />
                <CheckoutButton href={checkout}>Comprar agora</CheckoutButton>
              </div>
            </aside>
          </div>
        </section>

        <section className="hem-strip">
          <div className="hem-container hem-strip-inner">
            <div className="hem-strip-item">Material digital • acesso pela plataforma de venda</div>
            <div className="hem-strip-item">Conteúdo focado em APH e controle de hemorragias</div>
            <div className="hem-strip-item">{usesInternalCheckout(product) ? "Pagamento seguro: Pix, cartão ou boleto" : "Compra processada no checkout da Hotmart"}</div>
          </div>
        </section>

        <section className="hem-section">
          <div className="hem-container hem-problem">
            <div>
              <span className="hem-eyebrow">O PROBLEMA</span>
              <h2>Na pressão, saber “mais ou menos” pode não ser suficiente.</h2>
              <p className="hem-lead">
                Informação solta não substitui raciocínio organizado. O objetivo deste material é ajudar você a revisar conceitos, reconhecer prioridades e estudar o controle de hemorragias de forma mais estruturada.
              </p>
            </div>
            <div className="hem-dark-card">
              <h3>Você já se pegou pensando...</h3>
              <p>“Qual é a prioridade aqui?”, “O que eu devo reconhecer primeiro?”, “Qual intervenção faz sentido neste cenário?”</p>
              <p>Essas dúvidas são exatamente o tipo de ponto que um estudo bem organizado precisa ajudar a reduzir.</p>
            </div>
          </div>
        </section>

        <section className="hem-section alt" id="conteudo">
          <div className="hem-container">
            <span className="hem-eyebrow">O QUE VOCÊ VAI ESTUDAR</span>
            <h2>Um caminho mais claro para revisar o controle de hemorragias.</h2>
            <div className="hem-grid3">
              <article className="hem-card"><div className="hem-number">01</div><b>Reconhecimento</b><p>Entenda o que observar e como identificar situações que exigem atenção imediata.</p></article>
              <article className="hem-card"><div className="hem-number">02</div><b>Prioridades</b><p>Organize o raciocínio para diferenciar o que precisa ser feito primeiro durante a abordagem.</p></article>
              <article className="hem-card"><div className="hem-number">03</div><b>Controle</b><p>Revise princípios e recursos utilizados no controle de hemorragias dentro do contexto educacional do APH.</p></article>
              <article className="hem-card"><div className="hem-number">04</div><b>Aplicação</b><p>Conecte teoria, contexto e tomada de decisão para estudar além da simples memorização.</p></article>
              <article className="hem-card"><div className="hem-number">05</div><b>Revisão</b><p>Tenha um material que pode ser retomado sempre que você precisar reforçar sua base.</p></article>
              <article className="hem-card"><div className="hem-number">06</div><b>Segurança</b><p>Estude com foco em princípios, protocolos e limites de atuação profissional.</p></article>
            </div>
          </div>
        </section>

        <section className="hem-midcta">
          <div className="hem-container">
            <h2>Não espere a dúvida aparecer no pior momento para começar a estudar o assunto.</h2>
            <p>Adquira o material e avance na sua preparação com uma base mais organizada.</p>
            <CheckoutButton href={checkout}>Quero meu acesso agora</CheckoutButton>
          </div>
        </section>

        <section className="hem-section">
          <div className="hem-container">
            <span className="hem-eyebrow">PARA QUEM É</span>
            <h2>Feito para quem quer estudar APH com mais direção.</h2>
            <div className="hem-checklist">
              <div className="hem-check">Estudantes da área da saúde que querem construir uma base mais sólida.</div>
              <div className="hem-check">Profissionais que desejam revisar conceitos relacionados ao controle de hemorragias.</div>
              <div className="hem-check">Alunos de cursos de APH, urgência e emergência que buscam material complementar.</div>
              <div className="hem-check">Quem prefere conteúdo objetivo, organizado e aplicável ao estudo.</div>
            </div>
          </div>
        </section>

        <section className="hem-section alt">
          <div className="hem-container hem-product">
            <div>
              {product.cover_url && <img className="hem-product-image" src={product.cover_url} alt={product.title} loading="lazy" />}
            </div>
            <div className="hem-product-copy">
              <span className="hem-eyebrow">O MATERIAL</span>
              <h2>{product.title}</h2>
              <p className="hem-lead">{product.short_description}</p>
              {product.full_description && <div className="hem-full">{product.full_description}</div>}
              <div className="hem-buybox">
                {currentPrice !== null && currentPrice !== undefined && (
                  <div className="hem-price">
                    <strong>{formatPrice(currentPrice)}</strong>
                    {product.promotional_price !== null && product.price !== null && <del>{formatPrice(product.price)}</del>}
                  </div>
                )}
                <Installments product={product} />
                <CheckoutButton href={checkout}>{usesInternalCheckout(product) ? "Comprar agora" : "Comprar agora na Hotmart"}</CheckoutButton>
                <p className="hem-buybox-note">Você será direcionado para o checkout seguro cadastrado para este produto.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="hem-section">
          <div className="hem-container">
            <span className="hem-eyebrow">DÚVIDAS FREQUENTES</span>
            <h2>Antes de adquirir.</h2>
            <div className="hem-faq">
              <details><summary>Como recebo o material?</summary><p>{usesInternalCheckout(product) ? "A compra é concluída aqui no site. Depois da confirmação do pagamento, o acesso é liberado na sua conta (use o mesmo e-mail da compra)." : "A compra é concluída na Hotmart. As instruções de acesso são fornecidas pela própria plataforma após a confirmação da compra."}</p></details>
              <details><summary>É um conteúdo voltado para APH?</summary><p>Sim. A proposta do material é educacional e direcionada ao estudo do controle de hemorragias dentro do contexto do atendimento pré-hospitalar.</p></details>
              <details><summary>Posso acessar novamente depois?</summary><p>O acesso e as condições de disponibilidade seguem o que estiver configurado para o produto na plataforma de venda.</p></details>
              <details><summary>O material substitui treinamento prático ou protocolo institucional?</summary><p>Não. O conteúdo é educacional e deve ser utilizado em conjunto com treinamento, protocolos, legislação e atribuições profissionais aplicáveis.</p></details>
            </div>
          </div>
        </section>

        <section className="hem-final">
          <div className="hem-container">
            <h2>Transforme dúvida em estudo antes de precisar transformar estudo em decisão.</h2>
            <p>Comece agora sua revisão sobre controle de hemorragias e fortaleça sua base no atendimento pré-hospitalar.</p>
            <CheckoutButton href={checkout}>Quero adquirir agora</CheckoutButton>
          </div>
        </section>
      </main>

      <footer className="hem-footer">
        <div className="hem-container">
          <p>© 2026 Hanif Alves • Conteúdo educacional. A aplicação prática deve respeitar protocolos, legislação e atribuições profissionais vigentes.</p>
          <Link to="/">Voltar para o site principal</Link>
        </div>
      </footer>

      <div className="hem-mobile-buy">
        <CheckoutButton href={checkout}>Comprar agora</CheckoutButton>
      </div>
    </div>
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

function StatIcon({ kind }) {
  const paths = {
    lessons: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m10 8 6 4-6 4V8Z" fill="currentColor" stroke="none" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    format: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    availability: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

export default function PublicProductPage() {
  const { slug } = useParams();
  const [settings, setSettings] = useState(fallbackSettings);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const lessonCounts = useLessonCounts();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("products").select("*").eq("slug", slug).in("status", ["active", "unlisted"]).maybeSingle(),
    ]).then(([settingsResult, productResult]) => {
      if (settingsResult.data) setSettings((current) => ({ ...current, ...settingsResult.data }));
      if (productResult.error || !productResult.data) {
        setNotFound(true);
      } else {
        setProduct(productResult.data);
        document.title = `${productResult.data.title} | Hanif Alves`;
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <main className="site-empty" style={{ minHeight: "100vh" }}>Carregando produto...</main>;

  if (notFound || !product) {
    return (
      <div className="site-page">
        <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />
        <section className="site-section" style={{ paddingTop: "calc(var(--header-h) + 40px)", minHeight: "60vh" }}>
          <div className="site-container">
            <h2>Produto não encontrado</h2>
            <p>Este produto pode estar inativo ou não existir mais.</p>
            <Link className="site-about-link" to="/">← Voltar para o início</Link>
          </div>
        </section>
        <SiteFooter settings={settings} />
      </div>
    );
  }

  if (slug === "controle-de-hemorragias") {
    return <HemorrhageLanding product={product} />;
  }

  const currentPrice = product.promotional_price ?? product.price;
  const hasDiscount = product.promotional_price !== null && product.price !== null && Number(product.price) > Number(product.promotional_price);
  const checkout = getProductCheckout(product);
  const count = lessonCounts[product.id];
  const stats = [
    count > 0 && { kind: "lessons", text: `${count} ${count === 1 ? "aula" : "aulas"}` },
    product.duration && { kind: "clock", text: product.duration },
    product.format && { kind: "format", text: product.format },
    product.availability_status && { kind: "availability", text: product.availability_status },
  ].filter(Boolean);
  const highlights = (Array.isArray(product.highlights) ? product.highlights : []).map((item) => String(item || "").trim()).filter(Boolean);

  return (
    <div className="site-page">
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />
      <style>{`
        .pp-hero{position:relative;overflow:hidden;padding-top:calc(var(--header-h) + 40px)}
        .pp-back{display:flex;width:fit-content;margin-bottom:26px}
        .pp-hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,0.95fr);gap:clamp(32px,6vw,80px);align-items:center}
        .pp-hero-copy h1{margin:10px 0 16px;font-family:var(--font-display);font-size:clamp(2.4rem,4.6vw,4.2rem);line-height:1.04;letter-spacing:-.03em;font-weight:800}
        .pp-lede{margin:0;max-width:52ch;color:var(--brand-text-soft);font-size:1.12rem;line-height:1.7}
        .pp-price{display:flex;align-items:baseline;gap:12px;margin:22px 0 0}
        .pp-price strong{font-family:var(--font-display);font-size:2.2rem;font-weight:800}
        .pp-price del{color:var(--brand-muted)}
        .pp-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
        .pp-hero-help{margin:12px 0 0;color:var(--brand-muted);font-size:.82rem}
        .pp-hero-media{position:relative}
        .pp-hero-frame{aspect-ratio:4/5;overflow:hidden;border-radius:var(--radius-lg);border:1px solid var(--brand-border);background:#06090d;box-shadow:var(--shadow-soft)}
        .pp-hero-frame img{width:100%;height:100%;object-fit:cover;display:block}
        .pp-hero-frame.is-empty{display:grid;place-items:center}
        .pp-hero-frame.is-empty img{width:30%;height:auto;object-fit:contain;opacity:.5}
        .pp-stats{border-top:1px solid var(--brand-border);border-bottom:1px solid var(--brand-border)}
        .pp-stats-row{display:flex;flex-wrap:wrap;gap:28px;padding:22px 0}
        .pp-stat{display:flex;align-items:center;gap:9px;color:var(--brand-text-soft);font-weight:700;font-size:.92rem}
        .pp-stat svg{flex:none;color:var(--brand-red)}
        .pp-about{max-width:720px}
        .pp-about-text{margin-top:18px;color:var(--brand-text-soft);font-size:1.05rem;line-height:1.85;white-space:pre-line}
        .pp-includes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 28px;margin-top:34px;padding:0;list-style:none}
        .pp-includes li{position:relative;padding-left:32px;color:var(--brand-text-soft, #fff);font-size:1rem;line-height:1.5}
        .pp-includes li::before{content:"";position:absolute;left:0;top:.15em;width:22px;height:22px;border-radius:50%;background:var(--brand-red) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5.5 10.5 3 3 6-6.5' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/58% no-repeat}
        .pp-final{padding:var(--section-y) 0;text-align:center;background:linear-gradient(135deg,var(--brand-navy),var(--brand-navy-deep))}
        .pp-final h2{margin:0 auto 14px;max-width:720px;font-family:var(--font-display);font-size:clamp(2rem,4vw,3.2rem);letter-spacing:-.02em;color:#fff}
        .pp-final p{margin:0 auto 24px;max-width:560px;color:var(--brand-on-dark-muted);line-height:1.7}
        .pp-mobile-buy{display:none}
        @media(max-width:900px){.pp-hero-grid{grid-template-columns:1fr}.pp-hero-media{order:-1}.pp-hero-frame{aspect-ratio:16/10}.pp-includes{grid-template-columns:1fr}}
        @media(max-width:640px){.pp-mobile-buy{display:block;position:fixed;left:12px;right:12px;bottom:12px;z-index:80}.pp-mobile-buy .site-btn{width:100%;box-shadow:0 14px 34px rgba(0,0,0,.35)}.pp-hero{padding-bottom:24px}}
      `}</style>

      <section className="pp-hero site-section">
        <div className="site-container pp-hero-grid">
          <div className="pp-hero-copy">
            <Link className="site-about-link pp-back" to="/">← Voltar para o site</Link>
            <span className="site-eyebrow">{product.category || "Produto educacional"}</span>
            <h1>{product.title}</h1>
            <p className="pp-lede">{product.short_description}</p>
            <ProductHighlights items={highlights} tone="dark" max={6} />
            {currentPrice !== null && currentPrice !== undefined && (
              <div className="pp-price">
                <strong>{formatPrice(currentPrice)}</strong>
                {hasDiscount && <del>{formatPrice(product.price)}</del>}
              </div>
            )}
            <Installments product={product} tone="dark" />
            <div className="pp-hero-actions">
              <a className="site-btn primary" href={checkout} {...checkoutLinkProps(checkout)}>
                {usesInternalCheckout(product) ? "Comprar agora" : "Quero acessar agora"}
              </a>
            </div>
            <p className="pp-hero-help">Ao clicar, você será direcionado para a página de compra cadastrada.</p>
          </div>
          <div className="pp-hero-media">
            <DiscountBadge product={product} />
            <div className={`pp-hero-frame ${product.cover_url ? "" : "is-empty"}`}>
              {product.cover_url ? <img src={product.cover_url} alt={`Capa de ${product.title}`} /> : <img src="/assets/logo-ha.png" alt="" />}
            </div>
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <div className="pp-stats">
          <div className="site-container pp-stats-row">
            {stats.map((stat) => (
              <span className="pp-stat" key={stat.kind}><StatIcon kind={stat.kind} />{stat.text}</span>
            ))}
          </div>
        </div>
      )}

      {product.full_description && (
        <section className="site-section">
          <div className="site-container pp-about">
            <span className="site-eyebrow">Sobre o curso</span>
            <h2>O que você vai estudar</h2>
            <p className="pp-about-text">{product.full_description}</p>
          </div>
        </section>
      )}

      {highlights.length > 0 && (
        <section className="site-section alt">
          <div className="site-container">
            <span className="site-eyebrow">Incluso</span>
            <h2>O que está incluso</h2>
            <ul className="pp-includes">
              {highlights.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {Array.isArray(product.faq) && product.faq.length > 0 && (
        <section className="site-section">
          <div className="site-container">
            <span className="site-eyebrow">Dúvidas</span>
            <h2>Perguntas frequentes</h2>
            <div className="site-faq-list">
              {product.faq.map((item, index) => (
                <details className="site-faq-item" key={index}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pp-final">
        <div className="site-container">
          <h2>Pronto para começar?</h2>
          <p>Garanta o seu acesso agora e comece a estudar {product.title.toLowerCase()} hoje mesmo.</p>
          <a className="site-btn primary" href={checkout} {...checkoutLinkProps(checkout)}>
            {usesInternalCheckout(product) ? "Comprar agora" : "Quero acessar agora"}
          </a>
        </div>
      </section>

      <SiteFooter settings={settings} />

      <div className="pp-mobile-buy">
        <a className="site-btn primary" href={checkout} {...checkoutLinkProps(checkout)}>
          {usesInternalCheckout(product) ? "Comprar agora" : "Quero acessar agora"}
        </a>
      </div>
    </div>
  );
}
