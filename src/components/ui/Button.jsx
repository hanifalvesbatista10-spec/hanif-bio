import { Link } from "react-router-dom";

// variant: primary (vermelho) | secondary (contorno) | ghost (texto + seta)
export default function Button({ to, href, variant = "primary", children, className = "", external, ...rest }) {
  const cls = `hx-btn is-${variant} ${className}`.trim();
  if (to) {
    return (
      <Link className={cls} to={to} {...rest}>
        {children}
      </Link>
    );
  }
  const extra = external ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <a className={cls} href={href} {...extra} {...rest}>
      {children}
    </a>
  );
}
