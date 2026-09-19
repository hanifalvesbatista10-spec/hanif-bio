import { Link } from "react-router-dom";
import Container from "../ui/Container";
import Eyebrow from "../ui/Eyebrow";
import ProductImage from "../ui/ProductImage";
import Reveal from "../ui/Reveal";

// Só usa dados reais do admin: authority_line ("10 anos na linha de frente • SAMU 192 • ...")
// e professional_roles. Se a primeira parte começar com número, ela vira o destaque gigante.
export default function Authority({ settings }) {
  const parts = String(settings.authority_line || "")
    .split("•")
    .map((part) => part.trim())
    .filter(Boolean);
  const lead = parts[0]?.match(/^(\d+)\s+(anos?)\s+(.+)$/i);
  const credentials = lead ? parts.slice(1) : parts;
  const roles = Array.isArray(settings.professional_roles) ? settings.professional_roles : [];

  return (
    <section className="hx-section hx-authority" id="sobre" aria-labelledby="authority-title">
      <span className="hx-bgword is-right" aria-hidden="true">HA</span>
      <Container className="hx-authority-grid">
        <Reveal className="hx-authority-copy">
          <Eyebrow>Quem ensina</Eyebrow>
          <h2 id="authority-title">Hanif Alves</h2>

          {lead && (
            <p className="hx-bignumber">
              <strong>{lead[1]}</strong>
              <span>
                {lead[2]}
                <small>{lead[3]}</small>
              </span>
            </p>
          )}

          {credentials.length > 0 && (
            <ul className="hx-credentials" aria-label="Credenciais">
              {credentials.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {roles.length > 0 && <p className="hx-roles">{roles.join(" · ")}</p>}

          <Link className="hx-link" to="/sobre">
            Conhecer a trajetória completa
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </Reveal>

        <Reveal delay={100} className="hx-authority-photo">
          <ProductImage
            src={settings.hero_image_url}
            alt="Hanif Alves, instrutor de APH"
            sizes="(max-width: 900px) 92vw, 560px"
          />
        </Reveal>
      </Container>
    </section>
  );
}
