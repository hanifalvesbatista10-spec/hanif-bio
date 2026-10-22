import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { fetchAllRows } from "../../services/paging";

// hold_released_at/access_hold_enabled (SQL 30, garantia de 7 dias) são opcionais: sem eles, a busca cai para as colunas básicas.
const HOLD_COLUMNS = "id,access_status,granted_at,hold_released_at,user_id,product_id,product:products(title,access_hold_enabled)";
const BASIC_COLUMNS = "id,access_status,granted_at,user_id,product_id,product:products(title)";
const LIST_LIMIT = 100;

const norm = (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dayLabel = (iso) => new Date(iso).toLocaleDateString("pt-BR");

// A garantia de 7 dias (SQL 30) ainda vale para este acesso?
function holdActive(grant) {
  if (!grant.product?.access_hold_enabled || grant.hold_released_at) return false;
  return Date.now() < new Date(grant.granted_at).getTime() + 7 * 24 * 60 * 60 * 1000;
}

const holdEndsAt = (grant) => dayLabel(new Date(new Date(grant.granted_at).getTime() + 7 * 24 * 60 * 60 * 1000));

// Lista de alunos com busca; ao clicar em um, aparecem os cursos dele, onde você adiciona, revoga ou encerra a garantia.
export default function AccessPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("aluno") || "";
  const [students, setStudents] = useState([]);
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState(() => new Map()); // aluno -> número de cursos com acesso ativo
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | with | without
  const [grants, setGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [holdAvailable, setHoldAvailable] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const loadList = useCallback(async () => {
    const [profilesResult, productsResult, grantsResult] = await Promise.all([
      fetchAllRows(() => supabase.from("profiles").select("id,full_name,email,role").order("id")),
      supabase.from("products").select("id,title").order("title", { ascending: true }),
      fetchAllRows(() => supabase.from("user_products").select("user_id,access_status").eq("access_status", "active").order("user_id")),
    ]);
    if (profilesResult.error) notify("error", `Não foi possível carregar os alunos: ${profilesResult.error.message}`);
    else {
      setStudents(
        (profilesResult.data || []).sort((a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email), "pt-BR"))
      );
    }
    if (productsResult.data) setProducts(productsResult.data);
    if (!grantsResult.error) {
      const next = new Map();
      (grantsResult.data || []).forEach((row) => next.set(row.user_id, (next.get(row.user_id) || 0) + 1));
      setCounts(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadGrants = useCallback(async (studentId) => {
    if (!studentId) {
      setGrants([]);
      return;
    }
    setGrantsLoading(true);
    let result = await supabase.from("user_products").select(HOLD_COLUMNS).eq("user_id", studentId).order("granted_at", { ascending: false });
    const withHold = !result.error;
    if (result.error) result = await supabase.from("user_products").select(BASIC_COLUMNS).eq("user_id", studentId).order("granted_at", { ascending: false });
    if (result.error) notify("error", result.error.message);
    else {
      setGrants(result.data || []);
      setHoldAvailable(withHold);
    }
    setGrantsLoading(false);
  }, []);

  useEffect(() => {
    setNewProduct("");
    loadGrants(selectedId);
  }, [selectedId, loadGrants]);

  const selected = students.find((student) => student.id === selectedId) || null;
  const shown = useMemo(() => {
    const term = norm(search).trim();
    return students.filter((student) => {
      const has = (counts.get(student.id) || 0) > 0;
      if (filter === "with" && !has) return false;
      if (filter === "without" && has) return false;
      return !term || norm(student.full_name).includes(term) || norm(student.email).includes(term);
    });
  }, [students, counts, search, filter]);

  const pick = (id) => {
    setMessage("");
    const next = new URLSearchParams(params);
    if (id) next.set("aluno", id);
    else next.delete("aluno");
    setParams(next, { replace: true });
  };

  const bump = (studentId, delta) =>
    setCounts((current) => {
      const next = new Map(current);
      next.set(studentId, Math.max(0, (next.get(studentId) || 0) + delta));
      return next;
    });

  const activeGrants = grants.filter((grant) => grant.access_status === "active");
  const availableProducts = products.filter((product) => !activeGrants.some((grant) => grant.product_id === product.id));

  const addCourse = async (event) => {
    event.preventDefault();
    if (!selected || !newProduct) return notify("error", "Escolha o curso que você quer liberar.");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_products")
      .upsert({ user_id: selected.id, product_id: newProduct, access_status: "active", granted_by: auth?.user?.id || null }, { onConflict: "user_id,product_id" });
    setBusy(false);
    if (error) return notify("error", `Erro ao liberar acesso: ${error.message}`);
    const title = products.find((product) => product.id === newProduct)?.title;
    notify("success", `Acesso a “${title}” liberado para ${selected.full_name || selected.email}.`);
    setNewProduct("");
    bump(selected.id, 1);
    loadGrants(selected.id);
  };

  const revoke = async (grant) => {
    if (!window.confirm(`Revogar o acesso de ${selected?.full_name || selected?.email} a "${grant.product?.title}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("user_products").delete().eq("id", grant.id);
    setBusy(false);
    if (error) return notify("error", error.message);
    notify("success", `Acesso a “${grant.product?.title}” revogado.`);
    if (grant.access_status === "active") bump(grant.user_id, -1);
    loadGrants(grant.user_id);
  };

  const releaseHold = async (grant) => {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_products")
      .update({ hold_released_at: new Date().toISOString(), hold_released_by: auth?.user?.id || null })
      .eq("id", grant.id);
    setBusy(false);
    if (error) return notify("error", error.message);
    notify("success", `Garantia encerrada: ${selected?.full_name || selected?.email} já vê “${grant.product?.title}” inteiro.`);
    loadGrants(grant.user_id);
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Acessos dos alunos</h2>
        </div>
      </div>

      <p className="adm-hint">
        Busque o aluno e clique nele para ver todos os cursos a que ele tem acesso. Ali você libera um curso novo, revoga um acesso ou
        encerra a garantia de 7 dias.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <div className={`adm-acc${selected ? " has-detail" : ""}`}>
        <div className="adm-acc-list">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail…" aria-label="Buscar aluno" />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar alunos">
            <option value="all">Todos os cadastros</option>
            <option value="with">Com algum curso</option>
            <option value="without">Sem nenhum curso</option>
          </select>

          {loading ? (
            <div className="admin-empty">Carregando...</div>
          ) : shown.length === 0 ? (
            <div className="admin-empty">Nenhum aluno encontrado.</div>
          ) : (
            <>
              <ul aria-label="Alunos">
                {shown.slice(0, LIST_LIMIT).map((student) => {
                  const total = counts.get(student.id) || 0;
                  return (
                    <li key={student.id}>
                      <button type="button" className={student.id === selectedId ? "is-active" : ""} aria-current={student.id === selectedId ? "true" : undefined} onClick={() => pick(student.id)}>
                        <span>
                          <strong>{student.full_name || "Sem nome"}</strong>
                          <small>{student.email}</small>
                        </span>
                        <em className={total ? "is-on" : ""}>{total ? `${total} ${total === 1 ? "curso" : "cursos"}` : "sem curso"}</em>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {shown.length > LIST_LIMIT && <p className="adm-hint">Mostrando {LIST_LIMIT} de {shown.length}. Use a busca para achar o aluno.</p>}
            </>
          )}
        </div>

        <div className="adm-acc-detail">
          {!selected ? (
            <div className="admin-empty">Escolha um aluno na lista para ver e alterar os cursos dele.</div>
          ) : (
            <>
              <button type="button" className="adm-action adm-acc-back" onClick={() => pick("")}>← Voltar à lista</button>
              <header className="adm-acc-head">
                <h3>{selected.full_name || "Sem nome"}</h3>
                <small>{selected.email}{selected.role && selected.role !== "student" ? ` · ${selected.role}` : ""}</small>
              </header>

              <form className="adm-acc-add" onSubmit={addCourse}>
                <label>
                  Liberar um curso
                  <select value={newProduct} onChange={(event) => setNewProduct(event.target.value)} disabled={busy}>
                    <option value="">Escolha o curso…</option>
                    {availableProducts.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                  </select>
                </label>
                <button className="admin-button primary" type="submit" disabled={busy || !newProduct}>Liberar acesso</button>
              </form>

              <h4 className="adm-acc-title">Cursos deste aluno</h4>
              {grantsLoading ? (
                <div className="admin-empty">Carregando...</div>
              ) : grants.length === 0 ? (
                <div className="admin-empty">Este aluno não tem acesso a nenhum curso.</div>
              ) : (
                <ul className="adm-acc-courses">
                  {grants.map((grant) => {
                    const inHold = holdAvailable && holdActive(grant);
                    return (
                      <li key={grant.id}>
                        <div className="adm-acc-course-info">
                          <strong>{grant.product?.title || "Curso removido"}</strong>
                          <small>
                            Desde {dayLabel(grant.granted_at)}
                            {holdAvailable && grant.product?.access_hold_enabled && (
                              inHold ? ` · em garantia até ${holdEndsAt(grant)}` : grant.hold_released_at ? " · garantia encerrada antes da hora" : " · garantia de 7 dias já passou"
                            )}
                          </small>
                          <span className={`status-badge ${grant.access_status === "active" ? "published" : "draft"}`}>{grant.access_status === "active" ? "Ativo" : grant.access_status}</span>
                        </div>
                        <div className="adm-acc-course-actions">
                          {inHold && <button type="button" className="admin-button" onClick={() => releaseHold(grant)} disabled={busy}>Liberar tudo agora</button>}
                          <button type="button" className="admin-button adm-ghost" onClick={() => revoke(grant)} disabled={busy}>Revogar</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
