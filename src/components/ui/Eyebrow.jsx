export default function Eyebrow({ children, className = "" }) {
  return <span className={`hx-eyebrow ${className}`.trim()}>{children}</span>;
}
