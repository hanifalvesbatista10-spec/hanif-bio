import Container from "../ui/Container";

// Áreas reais cobertas pelos produtos e conteúdos publicados (mentoria, e-book de hemorragias).
const AREAS = ["APH", "Trauma", "Emergências clínicas", "Hemorragias", "Afogamento", "Capacitação"];

export default function ExpertiseStrip() {
  return (
    <div className="hx-strip" role="list" aria-label="Áreas de atuação">
      <Container className="hx-strip-inner">
        {AREAS.map((area) => (
          <span role="listitem" key={area}>{area}</span>
        ))}
      </Container>
    </div>
  );
}
