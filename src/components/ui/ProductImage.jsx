// Capas pesadas em PNG ganham uma versão WebP equivalente (mesmo conteúdo, ~95% menor).
// Qualquer outra URL (upload do admin, etc.) segue exatamente como veio do banco.
const WEBP = {
  "/assets/mentoria-capa.png": "/assets/mentoria-capa.webp",
  "/assets/ebook-hemorragias.png": "/assets/ebook-hemorragias.webp",
  "/assets/hanif-hero.png": "/assets/hanif-hero.webp",
};

export default function ProductImage({ src, alt = "", loading = "lazy", className, sizes, ...rest }) {
  if (!src) return null;
  const webp = WEBP[src];
  const img = (
    <img className={className} src={src} alt={alt} loading={loading} decoding="async" sizes={sizes} {...rest} />
  );
  if (!webp) return img;
  return (
    <picture>
      <source srcSet={webp} type="image/webp" sizes={sizes} />
      {img}
    </picture>
  );
}
