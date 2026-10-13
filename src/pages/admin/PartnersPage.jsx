import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

const isMissingTable = (error) => /partners|42p01|pgrst205|schema cache|does not exist/i.test(`${error?.code || ""} ${error?.message || ""}`);

// Parceiros: pessoas de confiança com acesso SÓ às provas que elas mesmas criam (SQL 52). Aqui você cadastra, pausa e define limites.
export default function PartnersPage() {
  const [partners, setPartners] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", display_name: "", data_controller: "" });

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("partners").select("*").order("created_at", { ascending: true });
    if (error) {
      if (isMissingTable(error)) setMissing(true);
      else notify("error", `Não foi possível carregar os parceiros: ${error.message}`);
      setLoading(false);
      return;
    }
    const rows = data || [];
    setPartners(rows);
    const ids = rows.map((row) => row.user_id);
    if (ids.length) {
      const [{ data: people }, { data: ownedForms }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name").in("id", ids),
        supabase.from("forms").select("id,created_by").in("created_by", ids),
      ]);
      setProfiles(Object.fromEntries((people || []).map((person) => [person.id, person])));
      const formIds = (ownedForms || []).map((item) => item.id);
      const { data: subs } = formIds.length ? await supabase.from("form_submissions").select("form_id").in("form_id", formIds).limit(20000) : { data: [] };
      const ownerOf = Object.fromEntries((ownedForms || []).map((item) => [item.id, item.created_by]));
      const next = {};
      ids.forEach((id) => { next[id] = { forms: 0, responses: 0 }; });
      (ownedForms || []).forEach((item) => { next[item.created_by].forms += 1; });
      (subs || []).forEach((sub) => { const owner = ownerOf[sub.form_id]; if (owner) next[owner].responses += 1; });
      setUsage(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email || !form.display_name.trim() || !form.data_controller.trim()) return notify("error", "Preencha o e-mail, o nome e o nome para o aviso de dados.");
    setSaving(true);
    const { data: person, error: lookupError } = await supabase.from("profiles").select("id,email,full_name,created_at").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle();
    if (lookupError || !person) {
      setSaving(false);
      return notify("error", "Essa pessoa ainda não criou conta. Peça para ela se cadastrar em /cadastro (e confirmar o e-mail) e tente de novo.");
    }
    // confere com você qual conta é essa (o e-mail do perfil pode ser editado pela própria pessoa)
    const created = person.created_at ? new Date(person.created_at).toLocaleDateString("pt-BR") : "data desconhecida";
    if (!window.confirm(`Dar acesso de parceiro à conta de "${person.full_name || "sem nome"}" (${person.email}), criada em ${created}? É a pessoa certa?`)) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("partners").insert({ user_id: person.id, display_name: form.display_name.trim(), data_controller: form.data_controller.trim() });
    setSaving(false);
    if (error) return notify("error", error.code === "23505" ? "Essa pessoa já é parceira." : `Não foi possível cadastrar: ${error.message}`);
    notify("success", "Parceiro cadastrado. Ele já pode entrar em /parceiro.");
    setForm({ email: "", display_name: "", data_controller: "" });
    load();
  };

  const patch = async (partner, values, okText) => {
    const { error } = await supabase.from("partners").update(values).eq("user_id", partner.user_id);
    if (error) return notify("error", `Não foi possível salvar: ${error.message}`);
    notify("success", okText);
    load();
  };

  const changeLimit = (partner, key, label) => {
    const answer = window.prompt(`${label} para ${partner.display_name} (número inteiro):`, String(partner[key]));
    if (answer === null) return;
    const value = Number(answer);
    if (!Number.isInteger(value) || value < 0 || value > 1000000) return notify("error", "Informe um número inteiro, por exemplo 50.");
    patch(partner, { [key]: value }, "Limite atualizado.");
  };

  const remove = async (partner) => {
    if (!window.confirm(`Remover o acesso de ${partner.display_name}? As provas dele são encerradas (param de receber respostas) e as respostas continuam guardadas no banco, mas só você consegue vê-las.`)) return;
    // encerra as provas antes: sem a linha de parceiro, o banco deixaria de aplicar os limites a elas
    const closed = await supabase.from("forms").update({ status: "closed" }).eq("created_by", partner.user_id);
    if (closed.error) return notify("error", `Não foi possível encerrar as provas dele: ${closed.error.message}`);
    const { error } = await supabase.from("partners").delete().eq("user_id", partner.user_id);
    if (error) return notify("error", `Não foi possível remover: ${error.message}`);
    notify("success", "Acesso removido.");
    load();
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">O banco ainda não tem a área de parceiros. Execute <strong>supabase/52_parceiro_provas.sql</strong> no SQL Editor do Supabase e recarregue.</div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ENGAJAMENTO</span>
          <h2>Parceiros</h2>
        </div>
      </div>

      <p className="adm-hint">
        Um parceiro entra em <strong>/parceiro</strong> e só consegue criar provas (pré e pós-testes) e ver as respostas <strong>das provas dele</strong>. Ele não enxerga
        seus cursos, alunos, pedidos nem finanças, e as provas dele nunca aparecem para os seus alunos. Os alunos dele respondem pelo link da prova, sem conta, e a
        prova mostra o aviso de que os dados serão usados por ele. Para cadastrar, a pessoa precisa antes criar uma conta em /cadastro.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <form className="cp-form" onSubmit={add}>
        <h3>Novo parceiro</h3>
        <div className="cp-grid">
          <label>E-mail da conta
            <input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="email@exemplo.com" required />
          </label>
          <label>Nome na área dele
            <input value={form.display_name} onChange={(e) => setForm((c) => ({ ...c, display_name: e.target.value }))} maxLength={120} placeholder="Ex.: Dr. Ricardo Siqueira" required />
          </label>
          <label>Nome no aviso de dados da prova
            <input value={form.data_controller} onChange={(e) => setForm((c) => ({ ...c, data_controller: e.target.value }))} maxLength={160} placeholder="Ex.: Dr. Ricardo Siqueira" required />
          </label>
        </div>
        <div className="form-actions">
          <button className="admin-button primary" type="submit" disabled={saving}>{saving ? "Cadastrando..." : "Cadastrar parceiro"}</button>
        </div>
      </form>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : partners.length === 0 ? (
        <div className="admin-empty">Nenhum parceiro ainda.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Parceiro</th><th>Provas</th><th>Respostas</th><th>Situação</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const used = usage[partner.user_id] || { forms: 0, responses: 0 };
                return (
                  <tr key={partner.user_id}>
                    <td><strong>{partner.display_name}</strong><small>{profiles[partner.user_id]?.email || "—"}</small><small>aviso: {partner.data_controller}</small></td>
                    <td>{used.forms} de {partner.max_forms}</td>
                    <td>{used.responses} de {partner.max_responses}</td>
                    <td><span className={`status-badge ${partner.active ? "published" : "draft"}`}>{partner.active ? "Ativo" : "Pausado"}</span></td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <button type="button" className="adm-action" onClick={() => patch(partner, { active: !partner.active }, partner.active ? "Parceiro pausado: ele não entra e as provas dele param de receber respostas." : "Parceiro reativado.")}>
                          {partner.active ? "Pausar" : "Reativar"}
                        </button>
                        <button type="button" className="adm-action" onClick={() => changeLimit(partner, "max_forms", "Limite de provas")}>Limite de provas</button>
                        <button type="button" className="adm-action" onClick={() => changeLimit(partner, "max_responses", "Limite de respostas")}>Limite de respostas</button>
                        <button type="button" className="adm-action" onClick={() => remove(partner)}>Remover</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
