import Accent from "../ui/Accent";
import Button from "../ui/Button";
import Container from "../ui/Container";
import EcgLine from "../ui/EcgLine";
import Reveal from "../ui/Reveal";

export default function FinalCta({ settings }) {
  return (
    <section className="hx-section hx-final" aria-labelledby="final-title">
      <EcgLine className="hx-final-ecg" />
      <Container className="hx-final-inner">
        <Reveal>
          <h2 id="final-title">
            <Accent
              text="Seu próximo atendimento não precisa ser o *primeiro* momento em que você pensa no problema."
            />
          </h2>
          <div className="hx-actions is-center">
            <Button href="#produtos">Ver produtos e treinamentos</Button>
            {settings.whatsapp_url && (
              <Button href={settings.whatsapp_url} variant="secondary" external>
                Falar no WhatsApp
              </Button>
            )}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
