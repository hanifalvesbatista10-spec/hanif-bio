import { checkoutLinkProps, getProductCheckout } from "../../services/productCheckout";
import Accent from "../ui/Accent";
import Button from "../ui/Button";
import Container from "../ui/Container";
import Eyebrow from "../ui/Eyebrow";
import ProductImage from "../ui/ProductImage";
import Reveal from "../ui/Reveal";

export function money(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FeaturedProduct({ product, settings }) {
  const currentPrice = product.promotional_price ?? product.price;
  const isMentorship = product.slug === "mentoria-aph";
  const checkout = isMentorship
    ? null
    : getProductCheckout(product) || product.whatsapp_url || settings.whatsapp_url;
  const facts = [
    product.duration && { label: "Duração", value: product.duration },
    product.format && { label: "Formato", value: product.format },
    product.availability_status && { label: "Disponibilidade", value: product.availability_status },
    currentPrice !== null && currentPrice !== undefined && {
      label: "Investimento",
      value: money(currentPrice),
      old: product.promotional_price !== null && product.price !== null ? money(product.price) : null,
    },
  ].filter(Boolean);

  return (
    <section className="hx-section hx-featured" aria-labelledby="featured-title">
      <span className="hx-bgword" aria-hidden="true">{(product.category || "Formação").toUpperCase()}</span>
      <Container className="hx-featured-grid">
        <Reveal className="hx-featured-media">
          <div className="hx-featured-frame">
            <ProductImage
              src={product.cover_url}
              alt={product.title}
              loading="lazy"
              sizes="(max-width: 900px) 92vw, 600px"
            />
          </div>
        </Reveal>

        <Reveal delay={90} className="hx-featured-copy">
          <Eyebrow>Formação em destaque</Eyebrow>
          <span className="hx-chip">{product.category || "Formação"}</span>
          <h2 id="featured-title">
            <Accent text={product.title} />
          </h2>
          <p>{product.short_description}</p>

          {facts.length > 0 && (
            <dl className="hx-facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>
                    {fact.value}
                    {fact.old && <del>{fact.old}</del>}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="hx-actions">
            <Button to={`/produto/${product.slug}`}>
              {isMentorship ? "Conhecer a mentoria" : "Conhecer a formação"}
            </Button>
            {checkout && (
              <Button href={checkout} variant="secondary" external={Boolean(checkoutLinkProps(checkout).target)}>
                Quero acessar agora
              </Button>
            )}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
