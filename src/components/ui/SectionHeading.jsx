import Eyebrow from "./Eyebrow";

export default function SectionHeading({ eyebrow, title, lead, align = "left", id, className = "" }) {
  return (
    <header className={`hx-heading is-${align} ${className}`.trim()}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id}>{title}</h2>
      {lead && <p>{lead}</p>}
    </header>
  );
}
