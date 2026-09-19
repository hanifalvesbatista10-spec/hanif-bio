import { Link } from "react-router-dom";
import Accent from "../ui/Accent";
import Container from "../ui/Container";
import ProductImage from "../ui/ProductImage";
import Reveal from "../ui/Reveal";
import SectionHeading from "../ui/SectionHeading";

function formatContentDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

// Conteúdos/materiais gratuitos publicados (site_content). Some se não houver nenhum.
export default function ContentShowcase({ items }) {
  if (!items.length) return null;

  return (
    <section className="hx-section hx-content" id="conteudos" aria-labelledby="content-title">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Conteúdo gratuito"
            id="content-title"
            title={<Accent text="Conteúdos e materiais *gratuitos*." />}
            lead="Artigos e materiais para revisar e estudar sem custo."
          />
        </Reveal>

        <div className="hx-content-list">
          {items.map((item, index) => {
            const isMaterial = item.content_type === "material";
            const label = item.category || (isMaterial ? "Material gratuito" : "Conteúdo gratuito");
            return (
              <Reveal as="article" key={item.id} delay={index * 80} className="hx-content-row">
                {item.cover_url && (
                  <div className="hx-content-thumb">
                    <ProductImage src={item.cover_url} alt={item.title} sizes="220px" />
                  </div>
                )}
                <div className="hx-content-body">
                  <span className="hx-chip">{label}</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <small>{formatContentDate(item.published_at)} · Hanif Alves</small>
                </div>
                {isMaterial ? (
                  <a className="hx-btn is-secondary" href={item.download_url} target="_blank" rel="noreferrer">
                    Baixar material
                  </a>
                ) : (
                  <Link className="hx-btn is-secondary" to={`/conteudos/${item.slug}`}>
                    Ler conteúdo
                  </Link>
                )}
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
