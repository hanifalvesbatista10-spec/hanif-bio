import HeroMedia from "../site/HeroMedia";
import Accent from "../ui/Accent";
import Button from "../ui/Button";
import Container from "../ui/Container";
import EcgLine from "../ui/EcgLine";

export default function Hero({ settings, introActive }) {
  return (
    <section className="site-hero hx-hero" id="top" aria-label="Apresentação">
      <HeroMedia
        hold={introActive}
        alt="Hanif Alves, técnico de enfermagem socorrista e instrutor de APH, de braços cruzados"
      />

      <div className="hx-hero-backdrop" aria-hidden="true">
        <span className="hx-hero-word">APH</span>
      </div>

      <Container className="hx-hero-inner">
        <div className="hx-hero-copy">
          <span className="hx-identity">SAMU 192 · Urgência e Emergência</span>
          <h1>
            <Accent text={settings.hero_title} fallback={/situações críticas/i} />
          </h1>
          <p className="hx-hero-subtitle">{settings.hero_subtitle}</p>
          <div className="hx-hero-actions">
            <Button href="#produtos">{settings.hero_primary_label}</Button>
            <Button to="/sobre" variant="ghost">Conhecer o Hanif</Button>
          </div>
        </div>
      </Container>

      <EcgLine className="hx-hero-ecg" />
      <div className="hx-hero-fade" aria-hidden="true" />
    </section>
  );
}
