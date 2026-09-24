import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import RowActions from "../../components/admin/RowActions";

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
        .select("id,access_status,granted_at,user_id,product_id,profile:profiles!user_id(full_name,email),product:products(title)")
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

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_products")
      .upsert(
        { user_id: selectedStudent, product_id: selectedProduct, access_status: "active", granted_by: auth?.user?.id || null },
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
        Aqui você controla quem acessa cada produto na área de membros. Escolha o aluno e o produto e clique em “Liberar acesso”; para tirar o acesso, use “Revogar”.
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
                    <RowActions
                      label={`Ações do acesso de ${grant.profile?.full_name || grant.profile?.email}`}
                      items={[{ label: "Revogar acesso", danger: true, onClick: () => revokeAccess(grant) }]}
                    />
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
