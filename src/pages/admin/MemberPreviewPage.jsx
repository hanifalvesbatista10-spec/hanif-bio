import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { fetchProductLessons } from "../../services/lessons";

// Espelho da área de membros: carrega a tela REAL do aluno (/minha-area/curso/:id) dentro do painel.
// A tela do aluno só lista aulas publicadas, então o que aparece aqui é o que o aluno enxerga.
export default function MemberPreviewPage() {
  const [params, setParams] = useSearchParams();
  const productId = params.get("produto") || "";
  const lessonId = params.get("aula") || "";
  const studentId = params.get("aluno") || "";

  const [products, setProducts] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentAccess, setStudentAccess] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [device, setDevice] = useState("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "produto") next.delete("aula");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("id,title,status").order("title", { ascending: true }),
      supabase.from("profiles").select("id,full_name,email,role").eq("role", "student").order("full_name", { ascending: true }),
    ]).then(([productsResult, studentsResult]) => {
      if (productsResult.error) setMessage(productsResult.error.message);
      const list = productsResult.data || [];
      setProducts(list);
      setStudents(studentsResult.data || []);
      if (!params.get("produto") && list.length > 0) {
        const next = new URLSearchParams(params);
        next.set("produto", list[0].id);
        setParams(next, { replace: true });
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!productId) return;
    fetchProductLessons(productId).then(({ data }) => setLessons(data || []));
  }, [productId, reloadKey]);

  useEffect(() => {
    if (!studentId) {
      setStudentAccess([]);
      return;
    }
    supabase
      .from("user_products")
      .select("product_id,access_status,product:products(title)")
      .eq("user_id", studentId)
      .then(({ data }) => setStudentAccess(data || []));
  }, [studentId]);

  const published = lessons.filter((lesson) => lesson.status === "published");
  const drafts = lessons.filter((lesson) => lesson.status !== "published");
  const student = students.find((item) => item.id === studentId);
  const activeAccess = studentAccess.filter((item) => item.access_status === "active");
  const hasAccess = !studentId || activeAccess.some((item) => item.product_id === productId);

  const frameSrc = useMemo(() => {
    if (!productId) return "";
    const suffix = lessonId ? `?aula=${encodeURIComponent(lessonId)}` : "";
    return `/minha-area/curso/${productId}${suffix}`;
  }, [productId, lessonId]);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Ver como aluno</h2>
        </div>
        {frameSrc && (
          <a className="admin-button" href={frameSrc} target="_blank" rel="noreferrer">Abrir em nova aba</a>
        )}
      </div>

      <p className="adm-lead">
        Esta é a tela real que o aluno acessa em <strong>/minha-area</strong>. Ela mostra somente aulas publicadas,
        exatamente como o aluno vê.
      </p>

      {message && <div className="admin-alert error">{message}</div>}

      <div className="adm-controls">
        <label>
          Produto
          <select value={productId} onChange={(event) => setParam("produto", event.target.value)}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}{product.status !== "active" ? " (inativo)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          Aula
          <select value={lessonId} onChange={(event) => setParam("aula", event.target.value)}>
            <option value="">Primeira aula</option>
            {published.map((lesson, index) => (
              <option key={lesson.id} value={lesson.id}>{index + 1}. {lesson.title}</option>
            ))}
          </select>
        </label>

        <label>
          Conferir acesso de um aluno
          <select value={studentId} onChange={(event) => setParam("aluno", event.target.value)}>
            <option value="">Nenhum (visão geral)</option>
            {students.map((item) => (
              <option key={item.id} value={item.id}>{item.full_name || item.email}</option>
            ))}
          </select>
        </label>

        <div className="adm-segment" role="group" aria-label="Tamanho da tela">
          <button type="button" className={device === "desktop" ? "is-active" : ""} onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"}>Computador</button>
          <button type="button" className={device === "mobile" ? "is-active" : ""} onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"}>Celular</button>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Recarregar</button>
        </div>
      </div>

      <div className="adm-facts">
        <span><strong>{published.length}</strong> aula(s) publicada(s) — o aluno vê</span>
        <span><strong>{drafts.length}</strong> rascunho(s) — o aluno não vê</span>
        <Link to={`/admin/auditoria${productId ? `?produto=${productId}` : ""}`}>Abrir auditoria das aulas →</Link>
      </div>

      {student && (
        <div className={`admin-alert ${hasAccess ? "" : "error"}`}>
          {hasAccess ? (
            <>
              <strong>{student.full_name || student.email}</strong> tem acesso a:{" "}
              {activeAccess.map((item) => item.product?.title).filter(Boolean).join(", ") || "nenhum produto"}.
            </>
          ) : (
            <>
              <strong>{student.full_name || student.email}</strong> NÃO tem acesso ativo a este produto e não veria esta tela.
              Acessos ativos: {activeAccess.map((item) => item.product?.title).filter(Boolean).join(", ") || "nenhum"}.{" "}
              <Link to="/admin/acessos">Liberar acesso</Link>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : !productId ? (
        <div className="admin-empty">Nenhum produto cadastrado.</div>
      ) : (
        <div className={`adm-mirror is-${device}`}>
          <div className="adm-mirror-bar" aria-hidden="true">
            <span /><span /><span />
            <em>Visão do aluno · {device === "mobile" ? "celular" : "computador"}</em>
          </div>
          <iframe
            key={`${frameSrc}-${reloadKey}-${device}`}
            title="Área de membros como o aluno vê"
            src={frameSrc}
          />
        </div>
      )}
    </section>
  );
}
