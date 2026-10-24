import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { friendlyAuthError } from "../../services/authErrors";
import { buildCsv } from "../../services/finance";
import RowActions from "../../components/admin/RowActions";

const PAGE_SIZES = [25, 50, 100];
const SINCE_OPTIONS = [
  { value: "", label: "Qualquer data" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];
const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name", label: "Nome (A–Z)" },
  { value: "access", label: "Último acesso" },
];
const ROLE_LABEL = { student: "Aluno", user: "Usuário", admin: "Administrador" };
const STATUS_LABEL = { active: "Ativo", blocked: "Bloqueado", inactive: "Inativo" };

const number = (value) => Number(value || 0).toLocaleString("pt-BR");
const dayLabel = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

function downloadCsv(content, name) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Lista de usuários feita para crescer: a busca, os filtros e as páginas acontecem no banco (SQL 58), então a tela
// baixa só os 25 a 100 que está mostrando, mesmo com dezenas de milhares de cadastros.
export default function UsersPage() {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get("q") || "";
  const role = params.get("funcao") || "";
  const status = params.get("status") || "";
  const hasCourse = params.get("cursos") || "any";
  const product = params.get("curso") || "";
  const since = params.get("desde") || "";
  const sort = params.get("ordem") || "recent";
  const pageSize = PAGE_SIZES.includes(Number(params.get("tam"))) ? Number(params.get("tam")) : 25;
  const page = Math.max(1, Number(params.get("pagina")) || 1);

  const [searchText, setSearchText] = useState(urlSearch);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [busyId, setBusyId] = useState("");
  const [exporting, setExporting] = useState(false);
  const requestRef = useRef(0);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  // Atualiza um ou mais filtros na URL (voltar/recarregar mantém o filtro); mudar filtro volta para a página 1.
  const setFilters = useCallback(
    (patch, { keepPage = false } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(patch).forEach(([key, value]) => {
            if (value === "" || value === null || value === undefined || value === "any" || (key === "ordem" && value === "recent")) next.delete(key);
            else next.set(key, String(value));
          });
          if (!keepPage) next.delete("pagina");
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  // Digitou na busca: espera um instante antes de pedir ao banco.
  useEffect(() => {
    if (searchText.trim() === urlSearch) return undefined;
    const timer = setTimeout(() => setFilters({ q: searchText.trim() }), 350);
    return () => clearTimeout(timer);
  }, [searchText, urlSearch, setFilters]);

  const rpcArgs = useCallback(
    (offset, limit) => ({
      p_search: urlSearch,
      p_role: role,
      p_status: status,
      p_has_course: hasCourse,
      p_product: product || null,
      p_since_days: since ? Number(since) : null,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    }),
    [urlSearch, role, status, hasCourse, product, since, sort]
  );

  const loadPage = useCallback(async () => {
    const ticket = ++requestRef.current;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users", rpcArgs((page - 1) * pageSize, pageSize));
    if (ticket !== requestRef.current) return; // chegou resposta de uma busca antiga
    if (error) {
      notify("error", /admin_list_users|function/.test(error.message || "") ? "O banco ainda não tem a busca de usuários. Execute supabase/58_busca_de_usuarios.sql no SQL Editor." : error.message);
      setRows([]);
      setTotal(0);
    } else {
      const list = data || [];
      setRows(list);
      setTotal(list.length ? Number(list[0].total_count) : 0);
      // página que não existe mais (ex.: filtrou e sobrou pouco): volta para a primeira
      if (list.length === 0 && page > 1) setFilters({ pagina: "" });
    }
    setLoading(false);
  }, [rpcArgs, page, pageSize, setFilters]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const loadSummary = useCallback(async () => {
    const { data } = await supabase.rpc("admin_users_summary");
    if (data?.[0]) setSummary(data[0]);
  }, []);

  useEffect(() => {
    loadSummary();
    supabase.from("products").select("id,title").order("title", { ascending: true }).then(({ data }) => setProducts(data || []));
  }, [loadSummary]);

  const update = async (row, patch) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", row.id);
    if (error) return notify("error", error.message);
    notify("success", "Usuário atualizado.");
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, ...patch } : item)));
    loadSummary();
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

  // Exporta tudo o que o filtro atual encontrou (em blocos de 500), não só a página que está na tela.
  const exportCsv = async () => {
    setExporting(true);
    const lines = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.rpc("admin_list_users", rpcArgs(offset, 500));
      if (error) {
        setExporting(false);
        return notify("error", `Não foi possível exportar: ${error.message}`);
      }
      (data || []).forEach((row) =>
        lines.push([row.full_name || "", row.email, row.phone || "", ROLE_LABEL[row.role] || row.role, STATUS_LABEL[row.account_status] || row.account_status, Number(row.course_count), dayLabel(row.created_at), dayLabel(row.last_access)])
      );
      if ((data || []).length < 500) break;
    }
    setExporting(false);
    downloadCsv(buildCsv(["Nome", "E-mail", "Telefone", "Função", "Status", "Cursos ativos", "Cadastro", "Último acesso"], lines), `usuarios-${new Date().toISOString().slice(0, 10)}.csv`);
    notify("success", `${number(lines.length)} usuário(s) exportado(s).`);
  };

  const filtersActive = Boolean(urlSearch || role || status || product || since || hasCourse !== "any" || sort !== "recent");
  const clearFilters = () => {
    setSearchText("");
    setParams(new URLSearchParams(), { replace: true });
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const goTo = (next) => {
    setFilters({ pagina: next > 1 ? next : "" }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tiles = summary
    ? [
        { label: "Usuários", value: summary.total, onClick: clearFilters },
        { label: "Novos nos últimos 7 dias", value: summary.new_week, onClick: () => setFilters({ desde: "7" }) },
        { label: "Sem nenhum curso", value: summary.without_course, onClick: () => setFilters({ cursos: "without" }) },
        { label: "Bloqueados", value: summary.blocked, onClick: () => setFilters({ status: "blocked" }) },
      ]
    : [];

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ACESSO</span>
          <h2>Usuários</h2>
        </div>
        <div className="adm-head-actions">
          <button type="button" className="admin-button" onClick={exportCsv} disabled={exporting || total === 0}>
            {exporting ? "Exportando..." : `Exportar CSV (${number(total)})`}
          </button>
        </div>
      </div>

      <p className="adm-hint">
        Aluno sem conseguir entrar? No menu <strong>⋯</strong> da linha, use <strong>Enviar link de nova senha</strong>: ele recebe por e-mail um link para criar outra senha.
        Se o e-mail não chegar, confira se o envio de e-mails do Supabase está configurado (veja docs/login-e-emails.md).
      </p>

      {tiles.length > 0 && (
        <div className="adm-stats">
          {tiles.map((tile) => (
            <button type="button" key={tile.label} className="adm-stat" onClick={tile.onClick}>
              <strong>{number(tile.value)}</strong>
              <span>{tile.label}</span>
            </button>
          ))}
        </div>
      )}

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <div className="adm-user-filters">
        <input
          type="search"
          className="ord-search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone…"
          aria-label="Buscar usuários"
        />
        <select value={hasCourse} onChange={(event) => setFilters({ cursos: event.target.value })} aria-label="Filtrar por ter curso">
          <option value="any">Com ou sem curso</option>
          <option value="with">Com algum curso</option>
          <option value="without">Sem nenhum curso</option>
        </select>
        <select value={product} onChange={(event) => setFilters({ curso: event.target.value })} aria-label="Filtrar por curso">
          <option value="">Qualquer curso</option>
          {products.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <select value={role} onChange={(event) => setFilters({ funcao: event.target.value })} aria-label="Filtrar por função">
          <option value="">Todas as funções</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={status} onChange={(event) => setFilters({ status: event.target.value })} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={since} onChange={(event) => setFilters({ desde: event.target.value })} aria-label="Filtrar por data de cadastro">
          {SINCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={sort} onChange={(event) => setFilters({ ordem: event.target.value })} aria-label="Ordenar por">
          {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {filtersActive && <button type="button" className="adm-action" onClick={clearFilters}>Limpar filtros</button>}
      </div>

      <div className="admin-table-wrap" aria-busy={loading}>
        <table className="admin-table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Status</th><th>Cursos</th><th>Cadastro</th><th><span className="ra-th">Ações</span></th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.full_name || "Sem nome"}</strong><small>{row.phone || ""}</small></td>
                <td>{row.email}</td>
                <td>
                  <select value={row.role} onChange={(event) => update(row, { role: event.target.value })} aria-label={`Função de ${row.full_name || row.email}`}>
                    <option value="student">Aluno</option>
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td>
                  <select value={row.account_status} onChange={(event) => update(row, { account_status: event.target.value })} aria-label={`Status de ${row.full_name || row.email}`}>
                    <option value="active">Ativo</option>
                    <option value="blocked">Bloqueado</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </td>
                <td>{Number(row.course_count) > 0 ? `${row.course_count} ${Number(row.course_count) === 1 ? "curso" : "cursos"}` : <small>nenhum</small>}</td>
                <td>{dayLabel(row.created_at)}{row.last_access && <small>visto em {dayLabel(row.last_access)}</small>}</td>
                <td>
                  <RowActions
                    label={`Ações para ${row.full_name || row.email}`}
                    primary={{ label: "Cursos e acessos", to: `/admin/acessos?aluno=${row.id}` }}
                    items={[
                      { label: "Desempenho", to: `/admin/usuarios/${row.id}` },
                      { label: "Enviar link de nova senha", onClick: () => sendReset(row), disabled: busyId === row.id },
                      { label: "Reenviar e-mail de confirmação", onClick: () => resendConfirmation(row), disabled: busyId === row.id },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="admin-empty">Nenhum usuário encontrado{filtersActive ? " com esses filtros" : ""}.</div>}
        {loading && rows.length === 0 && <div className="admin-empty">Carregando...</div>}
      </div>

      <div className="adm-pager">
        <span>{total === 0 ? "Nenhum resultado" : `Mostrando ${number(first)}–${number(last)} de ${number(total)}`}</span>
        <label>
          Por página
          <select value={pageSize} onChange={(event) => setFilters({ tam: event.target.value === "25" ? "" : event.target.value })} aria-label="Usuários por página">
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="adm-pager-buttons">
          <button type="button" className="admin-button" onClick={() => goTo(page - 1)} disabled={page <= 1 || loading}>← Anterior</button>
          <span>Página {page} de {pages}</span>
          <button type="button" className="admin-button" onClick={() => goTo(page + 1)} disabled={page >= pages || loading}>Próxima →</button>
        </div>
      </div>
    </section>
  );
}
