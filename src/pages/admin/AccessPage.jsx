import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";

// hold_released_at/access_hold_enabled (SQL 30, garantia de 7 dias) são opcionais: sem eles, a busca cai para as colunas básicas.
const HOLD_COLUMNS = "id,access_status,granted_at,hold_released_at,user_id,product_id,product:products(title,access_hold_enabled)";
const BASIC_COLUMNS = "id,access_status,granted_at,user_id,product_id,product:products(title)";
const PAGE = 25;

const dayLabel = (iso) => new Date(iso).toLocaleDateString("pt-BR");

// A garantia de 7 dias (SQL 30) ainda vale para este acesso?
function holdActive(grant) {
  if (!grant.product?.access_hold_enabled || grant.hold_released_at) return false;
  return Date.now() < new Date(grant.granted_at).getTime() + 7 * 24 * 60 * 60 * 1000;
}

const holdEndsAt = (grant) => dayLabel(new Date(new Date(grant.granted_at).getTime() + 7 * 24 * 60 * 60 * 1000));

// Lista de alunos com busca no banco (SQL 58): só chegam 25 por vez, então funciona com qualquer número de cadastros.
// Ao clicar em um aluno, aparecem os cursos dele, onde você adiciona, revoga ou encerra a garantia.
export default function AccessPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("aluno") || "";
  const [students, setStudents] = useState([]); // resultados da busca (course_count = cursos ativos)
  const [total, setTotal] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState(null); // aluno aberto por link direto que não está nos resultados
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | with | without
  const searchRef = useRef(0);
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

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from("products").select("id,title").order("title", { ascending: true });
    if (data) setProducts(data);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Digitou: espera um instante antes de pedir ao banco.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchStudents = useCallback(
    async (offset) => {
      const { data, error } = await supabase.rpc("admin_list_users", {
        p_search: query,
        p_has_course: filter === "all" ? "any" : filter,
        p_sort: "name",
        p_limit: PAGE,
        p_offset: offset,
      });
      if (error) {
        notify("error", /admin_list_users|function/.test(error.message || "") ? "O banco ainda não tem a busca de usuários. Execute supabase/58_busca_de_usuarios.sql no SQL Editor." : error.message);
        return null;
      }
      return data || [];
    },
    [query, filter]
  );

  // A busca ou o filtro mudou: recomeça do primeiro resultado (ignora respostas de buscas antigas).
  useEffect(() => {
    const ticket = ++searchRef.current;
    setLoading(true);
    fetchStudents(0).then((list) => {
      if (ticket !== searchRef.current || list === null) return;
      setStudents(list);
      setTotal(list.length ? Number(list[0].total_count) : 0);
      setLoading(false);
    });
  }, [fetchStudents]);

  const loadMore = async () => {
    const ticket = searchRef.current;
    setLoadingMore(true);
    const list = await fetchStudents(students.length);
    if (ticket === searchRef.current && list) setStudents((current) => [...current, ...list]);
    setLoadingMore(false);
  };

  // Aluno aberto por link direto (ex.: da tela de Usuários) que não está entre os resultados da busca.
  useEffect(() => {
    if (!selectedId || students.some((student) => student.id === selectedId)) {
      setSelectedProfile(null);
      return;
    }
    supabase.from("profiles").select("id,full_name,email,role").eq("id", selectedId).maybeSingle().then(({ data }) => setSelectedProfile(data || null));
  }, [selectedId, students]);

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

  const selected = students.find((student) => student.id === selectedId) || selectedProfile;

  const pick = (id) => {
    setMessage("");
    const next = new URLSearchParams(params);
    if (id) next.set("aluno", id);
    else next.delete("aluno");
    setParams(next, { replace: true });
  };

  // Depois de liberar/revogar, atualiza o "N cursos" da lista sem refazer a busca.
  const bump = (studentId, delta) =>
    setStudents((current) => current.map((student) => (student.id === studentId ? { ...student, course_count: Math.max(0, Number(student.course_count || 0) + delta) } : student)));

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
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou telefone…" aria-label="Buscar aluno" />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar alunos">
            <option value="all">Todos os cadastros</option>
            <option value="with">Com algum curso</option>
            <option value="without">Sem nenhum curso</option>
          </select>

          {loading ? (
            <div className="admin-empty">Carregando...</div>
          ) : students.length === 0 ? (
            <div className="admin-empty">Nenhum aluno encontrado.</div>
          ) : (
            <>
              <ul aria-label="Alunos">
                {students.map((student) => {
                  const courseTotal = Number(student.course_count || 0);
                  return (
                    <li key={student.id}>
                      <button type="button" className={student.id === selectedId ? "is-active" : ""} aria-current={student.id === selectedId ? "true" : undefined} onClick={() => pick(student.id)}>
                        <span>
                          <strong>{student.full_name || "Sem nome"}</strong>
                          <small>{student.email}</small>
                        </span>
                        <em className={courseTotal ? "is-on" : ""}>{courseTotal ? `${courseTotal} ${courseTotal === 1 ? "curso" : "cursos"}` : "sem curso"}</em>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="adm-hint">Mostrando {students.length} de {total.toLocaleString("pt-BR")}.</p>
              {students.length < total && (
                <button type="button" className="admin-button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Carregando..." : "Mostrar mais"}</button>
              )}
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
