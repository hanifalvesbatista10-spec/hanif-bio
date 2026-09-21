import { Link } from "react-router-dom";
import { checkoutLinkProps, getProductCheckout } from "../../services/productCheckout";
import Accent from "../ui/Accent";
import Container from "../ui/Container";
import GlowCard from "../ui/GlowCard";
import ProductImage from "../ui/ProductImage";
import Reveal from "../ui/Reveal";
import SectionHeading from "../ui/SectionHeading";
import { money } from "./FeaturedProduct";

function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ProductTile({ product, number, settings }) {
  const currentPrice = product.promotional_price ?? product.price;
  const isMentorship = product.slug === "mentoria-aph";
  const checkout = isMentorship ? null : getProductCheckout(product) || product.whatsapp_url || settings.whatsapp_url;
  return (
    <GlowCard className="hx-tile is-product">
      <span className="hx-tile-number" aria-hidden="true">{number}</span>
      <div className="hx-tile-media">
        <ProductImage src={product.cover_url} alt={product.title} sizes="(max-width: 900px) 92vw, 640px" />
      </div>
      <div className="hx-tile-body">
        <span className="hx-chip">{product.category || "Formação"}</span>
        <h3><Link to={`/produto/${product.slug}`}>{product.title}</Link></h3>
        <p>{product.short_description}</p>
        {currentPrice !== null && currentPrice !== undefined && (
          <div className="hx-price">
            <strong>{money(currentPrice)}</strong>
            {product.promotional_price !== null && product.price !== null && <del>{money(product.price)}</del>}
          </div>
        )}
        <div className="hx-actions">
          <Link className="hx-btn is-secondary" to={`/produto/${product.slug}`}>Ver detalhes</Link>
          {checkout && (
            <a className="hx-btn is-primary" href={checkout} {...checkoutLinkProps(checkout)}>Quero acessar agora</a>
          )}
        </div>
      </div>
    </GlowCard>
  );
}

function LinkTile({ to, eyebrow, title, text, number }) {
  return (
    <GlowCard to={to} className="hx-tile is-link">
      <span className="hx-tile-number" aria-hidden="true">{number}</span>
      <span className="hx-chip">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="hx-link">
        Acessar
        <Arrow />
      </span>
    </GlowCard>
  );
}

// Demais formações + os outros pilares reais do hub (conteúdos gratuitos e área do aluno).
export default function ProductEcosystem({ products, settings }) {
  const pad = (n) => String(n).padStart(2, "0");
  const links = [
    {
      key: "conteudos", to: "/conteudos", eyebrow: "Gratuito", title: "Conteúdos e materiais",
      text: "Artigos e materiais para revisar e estudar sem custo.",
    },
    {
      key: "aluno", to: "/login", eyebrow: "Área do aluno", title: "Já é aluno?",
      text: "Acesse suas aulas e materiais na área de membros.",
    },
  ];
  const tiles = [
    ...products.map((product) => ({ kind: "product", key: product.id, product })),
    ...links.map((link) => ({ kind: "link", ...link })),
  ].map((tile, index) => ({ ...tile, number: pad(index + 2) }));

  return (
    <section className="hx-section hx-ecosystem" aria-labelledby="ecosystem-title">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Ecossistema de formações"
            id="ecosystem-title"
            title={<Accent text={settings.products_section_title} fallback={/evolução profissional/i} />}
            lead="Conteúdos objetivos para transformar conhecimento em decisão mais segura no atendimento."
          />
        </Reveal>

        <div className="hx-eco-grid" data-count={tiles.length}>
          {tiles.map((tile, index) => (
            <Reveal key={tile.key} delay={Math.min(index, 3) * 80} className={`hx-eco-cell is-${tile.kind}`}>
              {tile.kind === "product" ? (
                <ProductTile product={tile.product} number={tile.number} settings={settings} />
              ) : (
                <LinkTile to={tile.to} eyebrow={tile.eyebrow} title={tile.title} text={tile.text} number={tile.number} />
              )}
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
