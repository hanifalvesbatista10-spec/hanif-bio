import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const statusLabels = {
  draft: "Rascunho",
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado",
};

export default function ProductsPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setRows(data || []);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const removeProduct = async (product) => {
    const confirmed = window.confirm(
      `Excluir definitivamente o produto "${product.title}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      setMessage(`Não foi possível excluir: ${error.message}`);
      return;
    }

    setMessage("Produto excluído com sucesso.");
    load();
  };

  return (
    <section className="admin-section">
      <style>{`
        .products-admin-header{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:22px}
        .products-admin-header span{color:#d6152d;font-size:.72rem;font-weight:900;letter-spacing:.12em}
        .products-admin-header h2{margin:4px 0 0;color:#071426;font-size:2rem}
        .products-create-button{border:0;border-radius:12px;background:#d6152d;color:#fff;padding:13px 18px;font-weight:900;cursor:pointer}
        .products-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
        .product-manage-card{overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 12px 34px rgba(7,20,38,.06)}
        .product-manage-image{width:100%;height:210px;object-fit:cover;background:#eaf0f6}
        .product-manage-placeholder{height:210px;display:grid;place-items:center;background:#eaf0f6;color:#77889b;font-weight:800}
        .product-manage-body{padding:20px}
        .product-manage-status{display:inline-flex;padding:6px 9px;border-radius:999px;background:#eef3f7;color:#30475d;font-size:.7rem;font-weight:900}
        .product-manage-body h3{margin:12px 0 8px;color:#071426;font-size:1.22rem}
        .product-manage-body p{margin:0;color:#66798c;line-height:1.55;min-height:48px}
        .product-manage-link{display:block;margin-top:12px;color:#52677b;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .product-manage-actions{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:18px}
        .product-manage-actions button{min-height:43px;border-radius:11px;font-weight:900;cursor:pointer}
        .edit-product{border:0;background:#071426;color:#fff}
        .delete-product{border:1px solid #f1bdc5;background:#fff5f6;color:#bb1730;padding:0 14px}
        .products-empty{padding:45px;text-align:center;border:1px dashed #cbd5df;border-radius:18px;background:#fff;color:#63768a}
        @media(max-width:760px){.products-admin-header{align-items:stretch;flex-direction:column}.products-create-button{width:100%}.products-list{grid-template-columns:1fr}.product-manage-image,.product-manage-placeholder{height:185px}}
      `}</style>

      <div className="products-admin-header">
        <div>
          <span>CATÁLOGO</span>
          <h2>Produtos</h2>
        </div>

        <button
          type="button"
          className="products-create-button"
          onClick={() => navigate("/admin/produtos/novo")}
        >
          + Adicionar novo produto
        </button>
      </div>

      {message && <div className="admin-alert">{message}</div>}

      {loading ? (
        <div className="products-empty">Carregando produtos...</div>
      ) : rows.length === 0 ? (
        <div className="products-empty">
          Nenhum produto cadastrado. Clique em “Adicionar novo produto”.
        </div>
      ) : (
        <div className="products-list">
          {rows.map((product) => (
            <article className="product-manage-card" key={product.id}>
              {product.cover_url ? (
                <img
                  className="product-manage-image"
                  src={product.cover_url}
                  alt={`Capa de ${product.title}`}
                />
              ) : (
                <div className="product-manage-placeholder">Sem imagem</div>
              )}

              <div className="product-manage-body">
                <span className="product-manage-status">
                  {statusLabels[product.status] || product.status}
                </span>

                <h3>{product.title}</h3>
                <p>{product.short_description || "Produto sem descrição."}</p>

                {product.checkout_url && (
                  <span className="product-manage-link">
                    Venda: {product.checkout_url}
                  </span>
                )}

                <div className="product-manage-actions">
                  <button
                    type="button"
                    className="edit-product"
                    onClick={() => navigate(`/admin/produtos/${product.id}`)}
                  >
                    Editar produto
                  </button>

                  <button
                    type="button"
                    className="delete-product"
                    onClick={() => removeProduct(product)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
