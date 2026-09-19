import Accent from "../ui/Accent";
import Container from "../ui/Container";
import Reveal from "../ui/Reveal";
import SectionHeading from "../ui/SectionHeading";

export default function FaqSection({ faqs }) {
  if (!faqs.length) return null;

  return (
    <section className="hx-section hx-faq" id="faq" aria-labelledby="faq-title">
      <Container className="hx-faq-grid">
        <Reveal>
          <SectionHeading eyebrow="Dúvidas" id="faq-title" title={<Accent text="Perguntas *frequentes*." />} />
        </Reveal>
        <Reveal delay={80} className="hx-faq-list">
          {faqs.map((item) => (
            <details className="hx-faq-item" key={item.id}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
