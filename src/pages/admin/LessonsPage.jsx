import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

const statusLabels = { draft: "Rascunho", published: "Publicada" };

function emptyLesson(productId) {
  return { id: null, product_id: productId, title: "", description: "", video_url: "", duration: "", status: "draft", position: 0 };
}

export default function LessonsPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id,title")
      .order("title", { ascending: true })
      .then(({ data }) => {
        setProducts(data || []);
        if (data && data.length > 0) setProductId(data[0].id);
        setLoading(false);
      });
  }, []);

  const loadLessons = async (pid) => {
    if (!pid) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("product_lessons")
      .select("*")
      .eq("product_id", pid)
      .order("position", { ascending: true });

    if (error) {
      setMessageType("error");
      setMessage(
        error.message.includes("does not exist") || error.message.includes("relation")
          ? "O banco ainda não tem a tabela de aulas. Execute supabase/12_area_de_membros.sql no SQL Editor e tente novamente."
          : `Erro ao carregar: ${error.message}`
      );
    } else {
      setLessons(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (productId) loadLessons(productId);
  }, [productId]);

  const addNew = () => setLessons((current) => [...current, emptyLesson(productId)]);

  const updateRow = (index, key, value) => {
    setLessons((current) => {
      const next = current.slice();
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const saveRow = async (index) => {
    const row = lessons[index];
    const title = row.title.trim();
    const videoUrl = row.video_url.trim();
    if (!title || !videoUrl) {
      setMessageType("error");
      setMessage("Preencha ao menos o título e o link do vídeo.");
      return;
    }

    setSavingId(row.id || `new-${index}`);
    setMessage("");

    const payload = {
      product_id: productId,
      title,
      description: row.description?.trim() || null,
      video_url: videoUrl,
      duration: row.duration?.trim() || null,
      status: row.status,
      position: Number(row.position) || 0,
    };

    const result = row.id
      ? await supabase.from("product_lessons").update(payload).eq("id", row.id).select("*").single()
      : await supabase.from("product_lessons").insert(payload).select("*").single();

    if (result.error) {
      setMessageType("error");
      setMessage(`Erro ao salvar: ${result.error.message}`);
    } else {
      setMessageType("success");
      setMessage("Aula salva com sucesso.");
      setLessons((current) => {
        const next = current.slice();
        next[index] = result.data;
        return next;
      });
    }
    setSavingId(null);
  };

  const removeRow = async (index) => {
    const row = lessons[index];
    if (!row.id) {
      setLessons((current) => current.filter((_, i) => i !== index));
      return;
    }
    if (!window.confirm("Excluir esta aula definitivamente?")) return;
    const { error } = await supabase.from("product_lessons").delete().eq("id", row.id);
    if (error) {
      setMessageType("error");
      setMessage(`Erro ao excluir: ${error.message}`);
    } else {
      setMessage("Aula excluída.");
      setLessons((current) => current.filter((_, i) => i !== index));
    }
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Aulas por produto</h2>
        </div>
      </div>

      <div className="admin-toolbar" style={{ gridTemplateColumns: "1fr auto" }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.title}</option>
          ))}
        </select>
        <button type="button" onClick={addNew} disabled={!productId}>+ Nova aula</button>
      </div>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : lessons.length === 0 ? (
        <div className="admin-empty">Nenhuma aula cadastrada para este produto ainda.</div>
      ) : (
        <div className="admin-form" style={{ gap: 22 }}>
          {lessons.map((row, index) => (
            <div
              key={row.id || `new-${index}`}
              style={{ paddingBottom: 20, borderBottom: index < lessons.length - 1 ? "1px solid #edf1f4" : "none" }}
            >
              <div className="form-grid two">
                <label>Título<input value={row.title} onChange={(e) => updateRow(index, "title", e.target.value)} /></label>
                <label>Link do vídeo (YouTube)<input value={row.video_url} onChange={(e) => updateRow(index, "video_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
              </div>
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label>Descrição<textarea rows={2} value={row.description || ""} onChange={(e) => updateRow(index, "description", e.target.value)} /></label>
              </div>
              <div className="form-grid two" style={{ marginTop: 10 }}>
                <label>Duração<input value={row.duration || ""} onChange={(e) => updateRow(index, "duration", e.target.value)} placeholder="Ex: 12min" /></label>
                <label>
                  Status
                  <select value={row.status} onChange={(e) => updateRow(index, "status", e.target.value)}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-grid two" style={{ marginTop: 10 }}>
                <label>Ordem<input type="number" min="0" value={row.position} onChange={(e) => updateRow(index, "position", e.target.value)} /></label>
              </div>
              <div className="form-actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="admin-button primary"
                  disabled={savingId === (row.id || `new-${index}`)}
                  onClick={() => saveRow(index)}
                >
                  {savingId === (row.id || `new-${index}`) ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  className="admin-button"
                  style={{ background: "#fff0f2", color: "#ad1428" }}
                  onClick={() => removeRow(index)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
