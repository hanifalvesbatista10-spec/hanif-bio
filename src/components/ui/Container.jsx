export default function Container({ children, className = "", as: Tag = "div", ...rest }) {
  return (
    <Tag className={`site-container ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
