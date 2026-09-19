import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

export default function AccessPage() {
  const [students, setStudents] = useState([]);
  const [products, setProducts] = useState([]);
  const [grants, setGrants] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const load = async () => {
    setLoading(true);
    const [profilesResult, productsResult, grantsResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").order("full_name", { ascending: true }),
      supabase.from("products").select("id,title").order("title", { ascending: true }),
      supabase
        .from("user_products")
        .select("id,access_status,granted_at,user_id,product_id,profile:profiles(full_name,email),product:products(title)")
        .order("granted_at", { ascending: false }),
    ]);

    if (profilesResult.data) setStudents(profilesResult.data);
    if (productsResult.data) setProducts(productsResult.data);
    if (grantsResult.error) {
      setMessageType("error");
      setMessage(grantsResult.error.message);
    } else {
      setGrants(grantsResult.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grantAccess = async (event) => {
    event.preventDefault();
    if (!selectedStudent || !selectedProduct) {
      setMessageType("error");
      setMessage("Selecione o aluno e o produto.");
      return;
    }

    const { error } = await supabase
      .from("user_products")
      .upsert(
        { user_id: selectedStudent, product_id: selectedProduct, access_status: "active" },
        { onConflict: "user_id,product_id" }
      );

    if (error) {
      setMessageType("error");
      setMessage(`Erro ao liberar acesso: ${error.message}`);
    } else {
      setMessageType("success");
      setMessage("Acesso liberado com sucesso.");
      load();
    }
  };

  const revokeAccess = async (grant) => {
    if (!window.confirm(`Revogar o acesso de ${grant.profile?.full_name || grant.profile?.email} a "${grant.product?.title}"?`)) return;
    const { error } = await supabase.from("user_products").delete().eq("id", grant.id);
    if (error) {
      setMessageType("error");
      setMessage(error.message);
    } else {
      setMessage("Acesso revogado.");
      load();
    }
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Acessos dos alunos</h2>
        </div>
      </div>

      <p style={{ color: "#66798c", marginBottom: 18 }}>
        Não há integração automática com Kiwify/Hotmart ainda — confirme a compra na plataforma de venda e libere o acesso aqui manualmente.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}

      <form className="admin-form" onSubmit={grantAccess} style={{ marginBottom: 24 }}>
        <div className="form-grid two">
          <label>
            Aluno
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
              <option value="">Selecione...</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.full_name || student.email} ({student.email})</option>
              ))}
            </select>
          </label>
          <label>
            Produto
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
              <option value="">Selecione...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.title}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button className="admin-button primary" type="submit">Liberar acesso</button>
        </div>
      </form>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : grants.length === 0 ? (
        <div className="admin-empty">Nenhum acesso liberado ainda.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Produto</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td>
                    <strong>{grant.profile?.full_name || "Sem nome"}</strong>
                    <small>{grant.profile?.email}</small>
                  </td>
                  <td>{grant.product?.title}</td>
                  <td><span className={`status-badge ${grant.access_status === "active" ? "published" : "draft"}`}>{grant.access_status}</span></td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => revokeAccess(grant)}>Revogar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
