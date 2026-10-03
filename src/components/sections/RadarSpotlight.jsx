import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { POPULATION_LABELS, TOPIC_LABELS, TYPE_LABELS, formatDate } from "../../services/radar";
import Accent from "../ui/Accent";
import Container from "../ui/Container";
import Reveal from "../ui/Reveal";
import SectionHeading from "../ui/SectionHeading";

// Vitrine do Radar de Evidências na página inicial: primeiro as análises que o administrador marcou como destaque,
// depois as mais recentes. Só mostra o que está publicado e aprovado (o banco garante) e some se não houver nenhum.
export default function RadarSpotlight() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    supabase
      .from("radar_items")
      .select("id,title_pt,title_original,topic,population,publication_type,summary_pt,published_date,reviewer_name,approved_at,featured")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (!error) setItems(data || []);
      });
  }, []);

  if (!items.length) return null;

  return (
    <section className="hx-section hx-content" id="radar" aria-labelledby="radar-title">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Radar de Evidências"
            id="radar-title"
            title={<Accent text="Novidades *científicas* em APH, revisadas." />}
            lead="O que há de novo em RCP, trauma, pediatria e coluna, analisado e conferido antes de ser publicado, com as referências originais."
          />
        </Reveal>

        <div className="hx-content-list">
          {items.map((item, index) => (
            <Reveal as="article" key={item.id} delay={index * 80} className="hx-content-row">
              <div className="hx-content-body">
                <span className="hx-chip">{item.featured ? "Destaque · " : ""}{TOPIC_LABELS[item.topic] || "Radar"}</span>
                <h3>{item.title_pt || item.title_original}</h3>
                <p>{item.summary_pt}</p>
                <small>
                  {TYPE_LABELS[item.publication_type] || "Publicação"} · {POPULATION_LABELS[item.population] || "—"} · Revisado por {item.reviewer_name || "Hanif Alves"} em {formatDate(item.approved_at)}
                </small>
              </div>
              <Link className="hx-btn is-secondary" to={`/radar/${item.id}`}>Ver análise</Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p style={{ marginTop: 24 }}>
            <Link className="hx-btn is-primary" to="/radar">Ver todo o Radar de Evidências</Link>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
