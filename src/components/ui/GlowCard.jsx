import { Link } from "react-router-dom";

// Superfície com brilho sutil que segue o hover. Vira link quando recebe `to`/`href`.
export default function GlowCard({ to, href, children, className = "", ...rest }) {
  const cls = `hx-glow-card ${className}`.trim();
  if (to) return <Link className={cls} to={to} {...rest}>{children}</Link>;
  if (href) return <a className={cls} href={href} {...rest}>{children}</a>;
  return <div className={cls} {...rest}>{children}</div>;
}
