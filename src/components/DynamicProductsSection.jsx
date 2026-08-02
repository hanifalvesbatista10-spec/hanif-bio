import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const ORIGINAL_PRODUCT_SLUGS = new Set([
  "mentoria-aph",
  "controle-de-hemorragias",
  "comunidade-aph",
]);

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "";

  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function DynamicProductsSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,title,slug,short_description,cover_url,category,price,promotional_price,checkout_url,is_featured,display_order"
        )
        .eq("status", "active")
        .order("is_featured", { ascending: false })
        .order("display_order", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Erro ao carregar produtos públicos:", error);
        setProducts([]);
      } else {
        setProducts(
          (data || []).filter(
            (product) => !ORIGINAL_PRODUCT_SLUGS.has(product.slug)
          )
        );
      }

      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("public-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        load
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="dynamic-products-section">
      <style>{`
        .dynamic-products-section{padding:92px 0;background:#f4f7fa;color:#071426}
        .dynamic-products-heading{max-width:780px;margin:0 auto 38px;text-align:center}
        .dynamic-products-heading span{color:#d6152d;font-size:.74rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
        .dynamic-products-heading h2{margin:10px 0 12px;color:#071426;font-size:clamp(2rem,4vw,3.5rem);line-height:1.08;letter-spacing:-.04em}
        .dynamic-products-heading p{margin:0;color:#66798c;line-height:1.7}
        .dynamic-products-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:19px}
        .dynamic-product-card{overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(7,20,38,.09);border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(7,20,38,.08)}
        .dynamic-product-image{width:100%;aspect-ratio:16/10;object-fit:cover;background:#e6ecf2}
        .dynamic-product-no-image{aspect-ratio:16/10;display:grid;place-items:center;background:#e6ecf2;color:#6e8092;font-weight:800}
        .dynamic-product-body{display:flex;flex:1;flex-direction:column;padding:23px}
        .dynamic-product-category{color:#d6152d;font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
        .dynamic-product-body h3{margin:8px 0 9px;color:#071426;font-size:1.25rem;line-height:1.25}
        .dynamic-product-body p{flex:1;margin:0;color:#66798c;line-height:1.65;font-size:.91rem}
        .dynamic-product-price{display:flex;align-items:baseline;gap:8px;margin-top:16px}
        .dynamic-product-price strong{color:#071426;font-size:1.28rem}
        .dynamic-product-price del{color:#8c99a6;font-size:.82rem}
        .dynamic-product-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:18px}
        .dynamic-product-actions button,.dynamic-product-actions a{min-height:47px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-weight:900;text-align:center;cursor:pointer}
        .dynamic-product-detail{border:1px solid #d7e0e8;background:#fff;color:#20364d}
        .dynamic-product-buy{border:0;background:#d6152d;color:#fff}
        .dynamic-products-loading{padding:36px;text-align:center;color:#64768a}
        @media(max-width:920px){.dynamic-products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:620px){.dynamic-products-section{padding:66px 0}.dynamic-products-grid{grid-template-columns:1fr}.dynamic-product-actions{grid-template-columns:1fr}}
      `}</style>

      <div className="container">
        <div className="dynamic-products-heading">
          <span>MAIS PRODUTOS E FORMAÇÕES</span>
          <h2>Novas oportunidades para sua evolução profissional</h2>
          <p>
            Produtos adicionados diretamente pelo painel administrativo.
          </p>
        </div>

        {loading ? (
          <div className="dynamic-products-loading">
            Carregando produtos...
          </div>
        ) : (
          <div className="dynamic-products-grid">
            {products.map((product) => (
              <article className="dynamic-product-card" key={product.id}>
                {product.cover_url ? (
                  <img
                    className="dynamic-product-image"
                    src={product.cover_url}
                    alt={`Capa de ${product.title}`}
                    loading="lazy"
                  />
                ) : (
                  <div className="dynamic-product-no-image">Sem imagem</div>
                )}

                <div className="dynamic-product-body">
                  <span className="dynamic-product-category">
                    {product.category || "Produto"}
                  </span>

                  <h3>{product.title}</h3>
                  <p>{product.short_description}</p>

                  {(product.price !== null ||
                    product.promotional_price !== null) && (
                    <div className="dynamic-product-price">
                      <strong>
                        {formatPrice(
                          product.promotional_price ?? product.price
                        )}
                      </strong>

                      {product.promotional_price !== null &&
                        product.price !== null && (
                          <del>{formatPrice(product.price)}</del>
                        )}
                    </div>
                  )}

                  <div className="dynamic-product-actions">
                    <button
                      type="button"
                      className="dynamic-product-detail"
                      onClick={() => navigate(`/produto/${product.slug}`)}
                    >
                      Ver detalhes
                    </button>

                    <a
                      className="dynamic-product-buy"
                      href={product.checkout_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Comprar
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
