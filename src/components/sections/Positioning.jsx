import { Link } from "react-router-dom";
import Accent from "../ui/Accent";
import Container from "../ui/Container";
import Eyebrow from "../ui/Eyebrow";
import Reveal from "../ui/Reveal";

export default function Positioning({ settings }) {
  return (
    <section className="hx-section hx-position" id="posicionamento" aria-labelledby="position-title">
      <span className="hx-bgword" aria-hidden="true">APH</span>
      <Container className="hx-position-grid">
        <Reveal className="hx-position-side">
          <Eyebrow>Posicionamento</Eyebrow>
          <span className="hx-position-rule" aria-hidden="true" />
        </Reveal>
        <Reveal delay={80} className="hx-position-body">
          <h2 id="position-title" className="hx-statement">
            <Accent text={settings.about_title} fallback={/linha de frente/i} />
          </h2>
          <p>{settings.about_text}</p>
          <Link className="hx-link" to="/sobre">
            Conhecer a trajetória
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </Reveal>
      </Container>
    </section>
  );
}
