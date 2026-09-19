import Accent from "../ui/Accent";
import Container from "../ui/Container";
import Reveal from "../ui/Reveal";
import SectionHeading from "../ui/SectionHeading";

// Usa exatamente os passos editáveis no admin (site_settings.value_props).
export default function Method({ settings }) {
  const steps = Array.isArray(settings.value_props) ? settings.value_props : [];
  if (steps.length === 0) return null;

  return (
    <section className="hx-section hx-method" aria-labelledby="method-title">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Forma de ensino"
            id="method-title"
            title={<Accent text={settings.value_section_title} fallback={/improviso/i} />}
          />
        </Reveal>

        <ol className="hx-steps" style={{ "--steps": steps.length }}>
          {steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 100} className="hx-step">
              <span className="hx-step-node" aria-hidden="true" />
              <span className="hx-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
