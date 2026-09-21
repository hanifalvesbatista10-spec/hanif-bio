import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import { friendlyAuthError } from "../../services/authErrors";

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,phone,role,account_status,created_at,last_access")
      .order("created_at", { ascending: false });
    if (error) notify("error", error.message);
    else setRows(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id, patch) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) notify("error", error.message);
    else {
      notify("success", "Usuário atualizado.");
      load();
    }
  };

  // Ajuda ao aluno que "não consegue entrar": manda o link para ele criar uma nova senha.
  const sendReset = async (row) => {
    setBusyId(row.id);
    const { error } = await supabase.auth.resetPasswordForEmail(row.email, { redirectTo: `${window.location.origin}/atualizar-senha` });
    setBusyId("");
    if (error) notify("error", friendlyAuthError(error));
    else notify("success", `Link para criar nova senha enviado para ${row.email}. Peça para conferir também o spam.`);
  };

  const resendConfirmation = async (row) => {
    setBusyId(row.id);
    const { error } = await supabase.auth.resend({ type: "signup", email: row.email, options: { emailRedirectTo: `${window.location.origin}/login?confirmado=1` } });
    setBusyId("");
    if (error) notify("error", friendlyAuthError(error));
    else notify("success", `E-mail de confirmação reenviado para ${row.email}.`);
  };

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.full_name, row.email, row.phone].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [rows, query]);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ACESSO</span>
          <h2>Usuários</h2>
        </div>
      </div>

      <p className="adm-hint">
        Aluno sem conseguir entrar? Use <strong>Link de nova senha</strong>: ele recebe por e-mail um link para criar outra senha.
        Se o e-mail não chegar, confira se o envio de e-mails do Supabase está configurado (veja docs/login-e-emails.md).
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <input
        type="search"
        className="ord-search"
        style={{ width: "100%", maxWidth: 420, marginBottom: 14 }}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nome, e-mail ou telefone…"
        aria-label="Buscar usuários"
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Status</th><th>Cadastro</th><th>Ajuda com o login</th></tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.full_name || "Sem nome"}</strong><small>{row.phone || ""}</small></td>
                <td>{row.email}</td>
                <td>
                  <select value={row.role} onChange={(event) => update(row.id, { role: event.target.value })}>
                    <option value="student">Aluno</option>
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td>
                  <select value={row.account_status} onChange={(event) => update(row.id, { account_status: event.target.value })}>
                    <option value="active">Ativo</option>
                    <option value="blocked">Bloqueado</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </td>
                <td>{new Date(row.created_at).toLocaleDateString("pt-BR")}</td>
                <td>
                  <div className="table-actions">
                    <button type="button" onClick={() => sendReset(row)} disabled={busyId === row.id}>Link de nova senha</button>
                    <button type="button" onClick={() => resendConfirmation(row)} disabled={busyId === row.id}>Reenviar confirmação</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <div className="admin-empty">Nenhum usuário encontrado.</div>}
      </div>
    </section>
  );
}
