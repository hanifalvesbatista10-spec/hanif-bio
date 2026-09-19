import { Fragment } from "react";

// Destaca UMA palavra/trecho em vermelho.
// - Marcação explícita no texto do admin: *palavra* (asteriscos são removidos).
// - Sem marcação: usa `fallback` (RegExp) só se casar; senão devolve o texto puro.
export default function Accent({ text = "", fallback }) {
  if (!text) return null;
  const marked = text.split(/\*([^*]+)\*/);
  if (marked.length > 1) {
    return marked.map((part, index) =>
      index % 2 === 1 ? (
        <em className="hx-accent" key={index}>{part}</em>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      )
    );
  }
  const match = fallback ? text.match(fallback) : null;
  if (!match) return text;
  const start = match.index;
  const end = start + match[0].length;
  return (
    <>
      {text.slice(0, start)}
      <em className="hx-accent">{match[0]}</em>
      {text.slice(end)}
    </>
  );
}
