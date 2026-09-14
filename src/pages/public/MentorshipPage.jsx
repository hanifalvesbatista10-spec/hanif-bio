import { getProductCheckout } from "../../services/productCheckout";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { mentorshipProduct } from "../../services/productCheckout";

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
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}

export default function MentorshipPage() {
  const product = mentorshipProduct;
  useEffect(() => {
    window.scrollTo(0, 0);
    const previous = document.title;
    document.title = "Mentoria de APH | Hanif Alves";
    return () => { document.title = previous; };
  }, []);
  const currentPrice = product.promotional_price ?? product.price;
  const checkout = getProductCheckout(product);

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
          <a className="hem-mini-cta" href={checkout} target="_blank" rel="noreferrer">Adquirir agora</a>
        </div>
      </header>

      <main>
        <section className="hem-hero">
          <div className="hem-container hem-hero-grid">
            <div>
              <span className="hem-kicker">MENTORIA DE APH</span>
              <h1>Entenda as emergências. Aprofunde seu conhecimento em APH.</h1>
              <p className="hem-hero-copy">
                Uma mentoria teórica para profissionais e estudantes da saúde que querem ingressar nos serviços de urgência e emergência ou aprimorar seus conhecimentos. Estude emergências traumáticas, clínicas, psiquiátricas, afogamento e temas do atendimento pré-hospitalar.
              </p>
              <ul className="hem-hero-points">
                <li>Emergências traumáticas, clínicas e psiquiátricas.</li>
                <li>Afogamento e assuntos de urgência e emergência.</li>
                <li>Abordagem teórica voltada ao conhecimento em APH.</li>
              </ul>
              <div className="hem-actions">
                <CheckoutButton href={checkout}>Quero adquirir agora</CheckoutButton>
                <a className="hem-cta secondary" href="#conteudo">Conhecer a mentoria</a>
              </div>
            </div>

            <aside className="hem-hero-card">
              {product.cover_url && <img className="hem-cover" style={{aspectRatio: "auto", height: "auto"}} src={product.cover_url} alt={`Capa de ${product.title}`} />}
              <div className="hem-offer">
                <small>Mentoria de APH</small>
                <p className="hem-hero-copy">Confira o valor e as condições na Kiwify.</p>
                {currentPrice !== null && currentPrice !== undefined && (
                  <div className="hem-price">
                    <strong>{formatPrice(currentPrice)}</strong>
                    {product.promotional_price !== null && product.price !== null && <del>{formatPrice(product.price)}</del>}
                  </div>
                )}
                <CheckoutButton href={checkout}>Adquirir agora</CheckoutButton>
              </div>
            </aside>
          </div>
        </section>

        <section className="hem-strip">
          <div className="hem-container hem-strip-inner">
            <div className="hem-strip-item">Mentoria teórica • Urgência e emergência</div>
            <div className="hem-strip-item">10 anos de linha de frente em urgências e emergências</div>
            <div className="hem-strip-item">Compra processada no checkout da Kiwify</div>
          </div>
        </section>

        <section className="hem-section">
          <div className="hem-container hem-problem">
            <div>
              <span className="hem-eyebrow">O PROBLEMA</span>
              <h2>Estudar emergência vai além de um único tipo de ocorrência.</h2>
              <p className="hem-lead">
                Trauma, emergências clínicas, crises psiquiátricas e afogamento trazem contextos diferentes para o atendimento. A Mentoria de APH reúne esses temas para quem quer ampliar sua visão sobre urgência e emergência.
              </p>
            </div>
            <div className="hem-dark-card">
              <h3>Você já se pegou pensando...</h3>
              <p>“Estou estudando só trauma?”, “E as emergências clínicas?”, “Como ampliar meu conhecimento para outros contextos do APH?”</p>
              <p>Aqui, o estudo contempla diferentes situações de emergência, com uma abordagem teórica para aprofundar seu conhecimento.</p>
            </div>
          </div>
        </section>

        <section className="hem-section alt" id="conteudo">
          <div className="hem-container">
            <span className="hem-eyebrow">O QUE VOCÊ VAI ENCONTRAR</span>
            <h2>Os temas da mentoria, apresentados com clareza.</h2>
            <div className="hem-grid3">
              <article className="hem-card"><div className="hem-number">01</div><b>Emergências traumáticas</b><p>Estudo das situações de trauma no contexto do atendimento pré-hospitalar.</p></article>
              <article className="hem-card"><div className="hem-number">02</div><b>Emergências clínicas</b><p>Conteúdos sobre emergências de natureza clínica, ampliando o estudo para além do trauma.</p></article>
              <article className="hem-card"><div className="hem-number">03</div><b>Emergências psiquiátricas</b><p>Estudo das emergências psiquiátricas como parte dos diferentes contextos de urgência.</p></article>
              <article className="hem-card"><div className="hem-number">04</div><b>Afogamento</b><p>Conteúdo dedicado ao afogamento dentro do estudo das emergências.</p></article>
              <article className="hem-card"><div className="hem-number">05</div><b>Urgências e emergências</b><p>Assuntos de emergência em geral para ampliar seu repertório de estudo.</p></article>
              <article className="hem-card"><div className="hem-number">06</div><b>Atendimento pré-hospitalar</b><p>Uma abordagem teórica dos temas da mentoria para quem quer ingressar na área ou aprimorar conhecimentos.</p></article>
            </div>
          </div>
        </section>

        <section className="hem-midcta">
          <div className="hem-container">
            <h2>Amplie seu estudo em urgência e emergência.</h2>
            <p>Trauma, emergências clínicas, psiquiátricas e afogamento em uma mentoria teórica dedicada ao APH.</p>
            <CheckoutButton href={checkout}>Quero adquirir a mentoria</CheckoutButton>
          </div>
        </section>

        <section className="hem-section">
          <div className="hem-container">
            <span className="hem-eyebrow">PARA QUEM É</span>
            <h2>Para quem quer ingressar na área ou aprimorar conhecimentos.</h2>
            <div className="hem-checklist">
              <div className="hem-check">Estudantes da saúde que pretendem ingressar nos serviços de urgência e emergência.</div>
              <div className="hem-check">Profissionais da saúde que desejam aprimorar seus conhecimentos em APH.</div>
              <div className="hem-check">Quem busca estudar diferentes contextos: trauma, emergências clínicas, psiquiátricas e afogamento.</div>
              <div className="hem-check">Quem procura uma mentoria teórica para complementar sua formação.</div>
            </div>
          </div>
        </section>

        <section className="hem-section alt">
          <div className="hem-container hem-product">
            <div>
              {product.cover_url && <img className="hem-product-image" src={product.cover_url} alt={product.title} loading="lazy" />}
            </div>
            <div className="hem-product-copy">
              <span className="hem-eyebrow">SEU ACESSO À MENTORIA</span>
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
                <CheckoutButton href={checkout}>Adquirir agora</CheckoutButton>
                <p className="hem-buybox-note">Confira o valor, os itens incluídos e as condições da oferta no checkout da Kiwify.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="hem-section">
          <div className="hem-container">
            <span className="hem-eyebrow">DÚVIDAS FREQUENTES</span>
            <h2>Antes de adquirir.</h2>
            <div className="hem-faq">
              <details><summary>Como encontro as orientações de acesso?</summary><p>A compra é concluída na Kiwify. As instruções de acesso são fornecidas pela própria plataforma após a confirmação da compra.</p></details>
              <details><summary>Quais assuntos a mentoria aborda?</summary><p>Emergências traumáticas, clínicas e psiquiátricas, afogamento e assuntos de urgência e emergência no contexto do APH.</p></details>
              <details><summary>A mentoria é prática?</summary><p>Não. A mentoria é teórica, destinada a profissionais e estudantes da saúde que desejam ingressar na área ou aprimorar seus conhecimentos.</p></details>
              <details><summary>Onde vejo o valor e o que está incluído?</summary><p>Consulte o checkout da Kiwify para conferir as informações da oferta, o valor e as condições de pagamento antes de concluir a compra.</p></details>
              <details><summary>A mentoria substitui treinamento prático ou protocolo institucional?</summary><p>Não. O conteúdo é educacional e deve ser utilizado em conjunto com treinamento, protocolos, legislação e atribuições profissionais aplicáveis.</p></details>
            </div>
          </div>
        </section>

        <section className="hem-final">
          <div className="hem-container">
            <h2>Aprofunde seu estudo das emergências no APH.</h2>
            <p>Da emergência traumática à clínica e psiquiátrica, incluindo afogamento: conheça os temas, amplie seus estudos e participe da mentoria.</p>
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
        <CheckoutButton href={checkout}>Adquirir agora</CheckoutButton>
      </div>
    </div>
  );
}
