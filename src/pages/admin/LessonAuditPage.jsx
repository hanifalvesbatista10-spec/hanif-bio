import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { checkYoutubeVideo, toEmbedUrl, watchUrl, youtubeId } from "../../services/video";

const videoLabels = {
  ok: { text: "Vídeo encontrado", tone: "ok" },
  unavailable: { text: "Vídeo privado, removido ou sem incorporação", tone: "bad" },
  invalid: { text: "Link não reconhecido como YouTube", tone: "bad" },
  unknown: { text: "Não foi possível verificar", tone: "warn" },
};

// Problemas detectáveis só com os dados da aula (sem chamar o YouTube).
function staticIssues(lesson, siblings) {
  const issues = [];
  if (lesson.status !== "published") issues.push({ tone: "warn", text: "Rascunho — o aluno não vê" });
  if (!lesson.description?.trim()) issues.push({ tone: "warn", text: "Sem descrição" });
  if (!lesson.duration?.trim()) issues.push({ tone: "warn", text: "Sem duração" });
  if (!youtubeId(lesson.video_url) && lesson.video_provider === "youtube") {
    issues.push({ tone: "bad", text: "Link fora dos formatos aceitos pelo player" });
  }
  if (siblings.filter((item) => item.position === lesson.position).length > 1) {
    issues.push({ tone: "warn", text: `Ordem ${lesson.position} repetida` });
  }
  return issues;
}

export default function LessonAuditPage() {
  const [params, setParams] = useSearchParams();
  const productFilter = params.get("produto") || "";
  const [products, setProducts] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [access, setAccess] = useState([]);
  const [videoResults, setVideoResults] = useState({});
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("id,title,status").order("title", { ascending: true }),
      supabase.from("product_lessons").select("*").order("position", { ascending: true }),
      supabase.from("user_products").select("product_id,access_status"),
    ]).then(([productsResult, lessonsResult, accessResult]) => {
      if (productsResult.error) setMessage(productsResult.error.message);
      if (lessonsResult.error) {
        setMessage(
          lessonsResult.error.message.includes("does not exist") || lessonsResult.error.message.includes("relation")
            ? "O banco ainda não tem a tabela de aulas. Execute supabase/12_area_de_membros.sql no SQL Editor."
            : lessonsResult.error.message
        );
      }
      setProducts(productsResult.data || []);
      setLessons(lessonsResult.data || []);
      setAccess(accessResult.data || []);
      setLoading(false);
    });
  }, []);

  const groups = useMemo(
    () =>
      products
        .filter((product) => !productFilter || product.id === productFilter)
        .map((product) => {
          const items = lessons.filter((lesson) => lesson.product_id === product.id);
          const students = access.filter((row) => row.product_id === product.id && row.access_status === "active").length;
          return { product, items, students };
        }),
    [products, lessons, access, productFilter]
  );

  const visibleLessons = groups.flatMap((group) => group.items);

  const checkVideos = useCallback(async () => {
    setChecking(true);
    const queue = visibleLessons.filter((lesson) => lesson.video_provider === "youtube" || youtubeId(lesson.video_url));
    const results = {};
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const lesson = queue[cursor++];
        results[lesson.id] = await checkYoutubeVideo(lesson.video_url);
        setVideoResults({ ...results });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setChecking(false);
  }, [visibleLessons]);

  const totals = useMemo(() => {
    const published = visibleLessons.filter((lesson) => lesson.status === "published").length;
    const withProblems = visibleLessons.filter((lesson) => {
      const siblings = lessons.filter((item) => item.product_id === lesson.product_id);
      const issues = staticIssues(lesson, siblings).filter((issue) => issue.tone === "bad");
      const video = videoResults[lesson.id];
      return issues.length > 0 || video?.state === "unavailable" || video?.state === "invalid";
    }).length;
    return { total: visibleLessons.length, published, drafts: visibleLessons.length - published, withProblems };
  }, [visibleLessons, lessons, videoResults]);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Auditoria das aulas</h2>
        </div>
        <button type="button" className="admin-button primary" onClick={checkVideos} disabled={checking || visibleLessons.length === 0}>
          {checking ? "Verificando vídeos..." : "Verificar vídeos no YouTube"}
        </button>
      </div>

      <p className="adm-lead">
        Confira se cada aula está publicada, na ordem certa e com vídeo disponível. Use “Ver como aluno” para abrir a
        aula exatamente como ela aparece na área de membros.
      </p>

      {message && <div className="admin-alert error">{message}</div>}

      <div className="adm-controls is-single">
        <label>
          Produto
          <select value={productFilter} onChange={(event) => setParams(event.target.value ? { produto: event.target.value } : {}, { replace: true })}>
            <option value="">Todos os produtos</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="adm-stats is-four">
        <article className="adm-stat"><div><span>Aulas</span><strong>{totals.total}</strong></div></article>
        <article className="adm-stat"><div><span>Publicadas</span><strong>{totals.published}</strong></div></article>
        <article className="adm-stat"><div><span>Rascunhos</span><strong>{totals.drafts}</strong></div></article>
        <article className="adm-stat"><div><span>Com problema</span><strong>{totals.withProblems}</strong></div></article>
      </div>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="admin-empty">Nenhum produto encontrado.</div>
      ) : (
        groups.map(({ product, items, students }) => (
          <div className="adm-audit-group" key={product.id}>
            <header>
              <div>
                <h3>{product.title}</h3>
                <small>
                  {items.filter((lesson) => lesson.status === "published").length} publicada(s) de {items.length} ·{" "}
                  {students} aluno(s) com acesso ativo
                </small>
              </div>
              <Link className="admin-button" to={`/admin/area-de-membros?produto=${product.id}`}>Ver como aluno</Link>
            </header>

            {items.length === 0 ? (
              <div className="admin-empty">Nenhuma aula cadastrada. {students > 0 && "Há alunos com acesso e nada para assistir."}</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table adm-audit-table">
                  <thead>
                    <tr>
                      <th>Ordem</th>
                      <th>Aula</th>
                      <th>Status</th>
                      <th>Vídeo</th>
                      <th>Pontos de atenção</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((lesson) => {
                      const issues = staticIssues(lesson, items);
                      const video = videoResults[lesson.id];
                      const label = video ? videoLabels[video.state] : null;
                      return (
                        <tr key={lesson.id}>
                          <td>{lesson.position}</td>
                          <td>
                            <strong>{lesson.title}</strong>
                            <small>{lesson.duration || "—"}</small>
                          </td>
                          <td><span className={`status-badge ${lesson.status}`}>{lesson.status === "published" ? "Publicada" : "Rascunho"}</span></td>
                          <td>
                            {label ? (
                              <div className={`adm-check is-${label.tone}`}>
                                <strong>{label.text}</strong>
                                {video.title && <small>{video.title}</small>}
                              </div>
                            ) : (
                              <small>{youtubeId(lesson.video_url) ? "Ainda não verificado" : "—"}</small>
                            )}
                            {youtubeId(lesson.video_url) && !label && <small className="adm-mono">{toEmbedUrl(lesson.video_url).replace("https://", "")}</small>}
                          </td>
                          <td>
                            {issues.length === 0 ? (
                              <span className="adm-check is-ok"><strong>Tudo certo</strong></span>
                            ) : (
                              <ul className="adm-issues">
                                {issues.map((issue) => (
                                  <li key={issue.text} className={`is-${issue.tone}`}>{issue.text}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <Link to={`/admin/area-de-membros?produto=${product.id}&aula=${lesson.id}`}>Ver como aluno</Link>
                              {youtubeId(lesson.video_url) && (
                                <a href={watchUrl(lesson.video_url)} target="_blank" rel="noreferrer">YouTube</a>
                              )}
                              <Link to="/admin/aulas">Editar</Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
