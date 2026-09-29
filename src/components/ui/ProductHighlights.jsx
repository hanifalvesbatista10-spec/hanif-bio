import "../../styles/product-highlights.css";

// Selo "-N%" sobre a imagem do produto, só quando há preço promocional de verdade menor que o normal.
export function DiscountBadge({ product, className = "" }) {
  const price = Number(product?.price);
  const promo = Number(product?.promotional_price);
  if (!(promo > 0) || !(price > promo)) return null;
  const percent = Math.round((1 - promo / price) * 100);
  if (percent < 1) return null;
  return <span className={`ph-discount ${className}`.trim()}>-{percent}%</span>;
}

// Lista curta de benefícios do produto (products.highlights, SQL 31). `tone="dark"` para fundos escuros.
export function ProductHighlights({ items, tone = "light", max = 4, className = "" }) {
  const list = (Array.isArray(items) ? items : []).map((item) => String(item || "").trim()).filter(Boolean).slice(0, max);
  if (list.length === 0) return null;
  return (
    <ul className={`ph-highlights ${tone === "dark" ? "is-dark" : ""} ${className}`.trim().replace(/\s+/g, " ")}>
      {list.map((text, index) => (
        <li key={index}>{text}</li>
      ))}
    </ul>
  );
}

// "N aulas" a partir da contagem pública (product_lesson_counts, SQL 31). Some sozinho enquanto não vier.
export function LessonCountTag({ count, tone = "light", className = "" }) {
  if (!(count > 0)) return null;
  return (
    <span className={`ph-count ${tone === "dark" ? "is-dark" : ""} ${className}`.trim().replace(/\s+/g, " ")}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m10 8 6 4-6 4V8Z" />
        <rect x="3" y="4" width="18" height="16" rx="3" />
      </svg>
      {count} {count === 1 ? "aula" : "aulas"}
    </span>
  );
}
