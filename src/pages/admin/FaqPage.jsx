import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

const statusLabels = { draft: "Rascunho", published: "Publicado" };

function emptyFaq() {
  return { id: null, question: "", answer: "", status: "draft", display_order: 0, isNew: true };
}

export default function FaqPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_faqs")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) setMessage(`Erro ao carregar: ${error.message}`);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addNew = () => {
    setRows((current) => [...current, emptyFaq()]);
  };

  const updateRow = (index, key, value) => {
    setRows((current) => {
      const next = current.slice();
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const saveRow = async (index) => {
    const row = rows[index];
    const question = row.question.trim();
    const answer = row.answer.trim();
    if (!question || !answer) {
      setMessage("Preencha a pergunta e a resposta antes de salvar.");
      return;
    }

    setSavingId(row.id || `new-${index}`);
    setMessage("");

    const payload = {
      question,
      answer,
      status: row.status,
      display_order: Number(row.display_order) || 0,
    };

    const result = row.id
      ? await supabase.from("site_faqs").update(payload).eq("id", row.id).select("*").single()
      : await supabase.from("site_faqs").insert(payload).select("*").single();

    if (result.error) {
      setMessage(`Erro ao salvar: ${result.error.message}`);
    } else {
      setMessage("Pergunta salva com sucesso.");
      setRows((current) => {
        const next = current.slice();
        next[index] = { ...result.data, isNew: false };
        return next;
      });
    }
    setSavingId(null);
  };

  const removeRow = async (index) => {
    const row = rows[index];
    if (!row.id) {
      setRows((current) => current.filter((_, i) => i !== index));
      return;
    }
    if (!window.confirm("Excluir esta pergunta definitivamente?")) return;
    const { error } = await supabase.from("site_faqs").delete().eq("id", row.id);
    if (error) setMessage(`Erro ao excluir: ${error.message}`);
    else {
      setMessage("Pergunta excluída.");
      setRows((current) => current.filter((_, i) => i !== index));
    }
  };

  const move = async (index, direction) => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    const aOrder = a.display_order;
    const bOrder = b.display_order;

    setRows((current) => {
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

    if (a.id && b.id) {
      await Promise.all([
        supabase.from("site_faqs").update({ display_order: bOrder }).eq("id", a.id),
        supabase.from("site_faqs").update({ display_order: aOrder }).eq("id", b.id),
      ]);
    }
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>CONTEÚDO</span>
          <h2>Perguntas frequentes</h2>
        </div>
        <button type="button" className="admin-button primary" onClick={addNew}>+ Nova pergunta</button>
      </div>

      {message && <div className="admin-alert">{message}</div>}

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">Nenhuma pergunta cadastrada. Clique em "+ Nova pergunta".</div>
      ) : (
        <div className="admin-form" style={{ gap: 22 }}>
          {rows.map((row, index) => (
            <div
              key={row.id || `new-${index}`}
              style={{ paddingBottom: 20, borderBottom: index < rows.length - 1 ? "1px solid #edf1f4" : "none" }}
            >
              <div className="form-grid">
                <label>
                  Pergunta
                  <input value={row.question} onChange={(e) => updateRow(index, "question", e.target.value)} />
                </label>
                <label>
                  Resposta
                  <textarea rows={3} value={row.answer} onChange={(e) => updateRow(index, "answer", e.target.value)} />
                </label>
              </div>
              <div className="form-grid two" style={{ marginTop: 12 }}>
                <label>
                  Status
                  <select value={row.status} onChange={(e) => updateRow(index, "status", e.target.value)}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Ordem
                  <input type="number" min="0" value={row.display_order} onChange={(e) => updateRow(index, "display_order", e.target.value)} />
                </label>
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
                <button type="button" className="admin-button" onClick={() => move(index, "up")} disabled={index === 0}>↑ Mover</button>
                <button type="button" className="admin-button" onClick={() => move(index, "down")} disabled={index === rows.length - 1}>↓ Mover</button>
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
