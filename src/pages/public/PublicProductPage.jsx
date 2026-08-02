import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "";

  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function PublicProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });

    const load = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setProduct(null);
      } else {
        setProduct(data);
      }

      setLoading(false);
    };

    load();
  }, [slug]);

  if (loading) {
    return (
      <main className="public-product-loading">
        Carregando produto...
      </main>
    );
  }

  if (notFound || !product) {
    return (
      <main className="public-product-not-found">
        <h1>Produto não encontrado</h1>
        <p>Este produto pode estar inativo ou não existir mais.</p>
        <Link to="/">Voltar para o início</Link>
      </main>
    );
  }

  const currentPrice =
    product.promotional_price ?? product.price;

  return (
    <main className="public-product-page">
      <style>{`
        .public-product-page{min-height:100vh;padding:90px 0 110px;background:#f4f7fa;color:#071426}
        .public-product-shell{width:min(1120px,calc(100% - 30px));margin:0 auto}
        .public-product-back{display:inline-flex;margin-bottom:18px;color:#31485e;font-weight:900}
        .public-product-hero{overflow:hidden;border-radius:28px;background:#fff;box-shadow:0 24px 70px rgba(7,20,38,.12)}
        .public-product-cover{width:100%;max-height:600px;aspect-ratio:16/8;object-fit:cover;background:#e8eef3}
        .public-product-content{display:grid;grid-template-columns:1fr .42fr;gap:42px;padding:42px}
        .public-product-category{color:#d6152d;font-size:.74rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
        .public-product-copy h1{margin:10px 0 16px;color:#071426;font-size:clamp(2.3rem,5vw,4.8rem);line-height:1.03;letter-spacing:-.045em}
        .public-product-short{margin:0;color:#506478;font-size:1.1rem;line-height:1.75}
        .public-product-full{margin-top:26px;padding-top:24px;border-top:1px solid #e1e7ed;color:#485d72;line-height:1.8;white-space:pre-line}
        .public-product-buybox{align-self:start;position:sticky;top:92px;padding:27px;border-radius:20px;background:#071426;color:#fff}
        .public-product-buybox small{color:#9fb2c4;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
        .public-product-price{margin:12px 0 21px}
        .public-product-price strong{display:block;color:#fff;font-size:2rem}
        .public-product-price del{color:#98a8b8}
        .public-product-button{min-height:56px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:#d6152d;color:#fff;font-weight:900;text-align:center}
        .public-product-help{margin:13px 0 0;color:#aebcca;font-size:.77rem;line-height:1.5;text-align:center}
        .public-product-loading,.public-product-not-found{min-height:100vh;display:grid;place-content:center;text-align:center;background:#f4f7fa;color:#071426;padding:30px}
        .public-product-not-found a{margin-top:12px;color:#d6152d;font-weight:900}
        @media(max-width:820px){.public-product-content{grid-template-columns:1fr}.public-product-buybox{position:static}}
        @media(max-width:620px){.public-product-page{padding-top:72px}.public-product-cover{aspect-ratio:16/10}.public-product-content{padding:25px 20px}.public-product-hero{border-radius:20px}.public-product-copy h1{font-size:2.5rem}}
      `}</style>

      <div className="public-product-shell">
        <Link className="public-product-back" to="/">
          ← Voltar para o site
        </Link>

        <article className="public-product-hero">
          {product.cover_url && (
            <img
              className="public-product-cover"
              src={product.cover_url}
              alt={`Capa de ${product.title}`}
            />
          )}

          <div className="public-product-content">
            <div className="public-product-copy">
              <span className="public-product-category">
                {product.category || "Produto educacional"}
              </span>

              <h1>{product.title}</h1>
              <p className="public-product-short">
                {product.short_description}
              </p>

              {product.full_description && (
                <div className="public-product-full">
                  {product.full_description}
                </div>
              )}
            </div>

            <aside className="public-product-buybox">
              <small>Acesso ao produto</small>

              {currentPrice !== null && (
                <div className="public-product-price">
                  <strong>{formatPrice(currentPrice)}</strong>

                  {product.promotional_price !== null &&
                    product.price !== null && (
                      <del>{formatPrice(product.price)}</del>
                    )}
                </div>
              )}

              <a
                className="public-product-button"
                href={product.checkout_url}
                target="_blank"
                rel="noreferrer"
              >
                Comprar agora
              </a>

              <p className="public-product-help">
                Ao clicar, você será direcionado para a página de compra cadastrada.
              </p>
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
