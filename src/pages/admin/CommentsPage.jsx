import { useCallback, useEffect, useMemo, useState } from "react";
import { Comment, isMissingCommentsTable } from "../../components/member/LessonComments";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import RowActions from "../../components/admin/RowActions";
import "../../styles/member-area.css";

const tabs = [
  { id: "pending", label: "Sem resposta" },
  { id: "all", label: "Todos" },
  { id: "hidden", label: "Ocultos" },
];

export default function CommentsPage() {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [lessonProducts, setLessonProducts] = useState({});
  const [tab, setTab] = useState("pending");
  const [productFilter, setProductFilter] = useState("");
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("lesson_comments")
      .select("id,lesson_id,user_id,parent_id,author_name,author_role,body,status,created_at,lesson:product_lessons(id,title,product_id,product:products!product_lessons_product_id_fkey(id,title))")
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingCommentsTable(error)) setMissingTable(true);
      else notify("error", `Erro ao carregar: ${error.message}`);
      setComments([]);
    } else {
      setMissingTable(false);
      setComments(data || []);
    }
    // uma aula compartilhada pode estar em vários cursos
    const { data: linkRows } = await supabase.from("product_lesson_links").select("lesson_id,product:products(id,title)");
    if (linkRows) {
      const map = {};
      linkRows.forEach((row) => {
        if (row.product) (map[row.lesson_id] ||= []).push(row.product);
      });
      setLessonProducts(map);
    }
    setLoading(false);
  }, []);

  const productsOf = useCallback(
    (root) => lessonProducts[root.lesson_id] || (root.lesson?.product ? [root.lesson.product] : []),
    [lessonProducts]
  );

  useEffect(() => {
    load();
  }, [load]);

  const threads = useMemo(() => {
    const roots = comments.filter((item) => !item.parent_id);
    return roots
      .map((root) => ({ root, replies: comments.filter((item) => item.parent_id === root.id) }))
      .sort((a, b) => new Date(b.root.created_at) - new Date(a.root.created_at));
  }, [comments]);

  const products = useMemo(() => {
    const map = new Map();
    threads.forEach(({ root }) => {
      productsOf(root).forEach((product) => map.set(product.id, product.title));
    });
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [threads, productsOf]);

  const filtered = threads.filter(({ root, replies }) => {
    if (productFilter && !productsOf(root).some((product) => product.id === productFilter)) return false;
    const answered = replies.some((reply) => reply.author_role === "admin");
    if (tab === "pending") return root.status === "visible" && !answered && root.author_role !== "admin";
    if (tab === "hidden") return root.status === "hidden";
    return true;
  });

  const pendingCount = threads.filter(
    ({ root, replies }) => root.status === "visible" && root.author_role !== "admin" && !replies.some((reply) => reply.author_role === "admin")
  ).length;

  const sendReply = async (root) => {
    const body = (drafts[root.id] || "").trim();
    if (!body || !user) return;
    setBusyId(root.id);
    const { error } = await supabase
      .from("lesson_comments")
      .insert({ lesson_id: root.lesson_id, user_id: user.id, parent_id: root.id, body });
    if (error) {
      notify("error", `Erro ao responder: ${error.message}`);
    } else {
      setDrafts((current) => ({ ...current, [root.id]: "" }));
      notify("success", "Resposta publicada. O aluno já pode vê-la na aula.");
      await load();
    }
    setBusyId(null);
  };

  const toggleHidden = async (item) => {
    setBusyId(item.id);
    const { error } = await supabase
      .from("lesson_comments")
      .update({ status: item.status === "hidden" ? "visible" : "hidden" })
      .eq("id", item.id);
    if (error) notify("error", `Erro: ${error.message}`);
    else {
      notify("success", item.status === "hidden" ? "Comentário visível novamente." : "Comentário ocultado dos alunos.");
      await load();
    }
    setBusyId(null);
  };

  const remove = async (item) => {
    const isRoot = !item.parent_id;
    if (!window.confirm(isRoot ? "Excluir este comentário e todas as respostas?" : "Excluir esta resposta?")) return;
    setBusyId(item.id);
    const { error } = await supabase.from("lesson_comments").delete().eq("id", item.id);
    if (error) notify("error", `Erro ao excluir: ${error.message}`);
    else {
      notify("success", "Excluído.");
      await load();
    }
    setBusyId(null);
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>ÁREA DE MEMBROS</span>
          <h2>Comentários das aulas</h2>
        </div>
      </div>

      <p className="adm-lead">
        Responda as dúvidas dos alunos. Sua resposta aparece na própria aula, com a etiqueta “Instrutor”.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}

      {missingTable ? (
        <div className="admin-alert error">
          O banco ainda não tem a tabela de comentários. Execute <strong>supabase/13_comentarios_aulas.sql</strong> no
          SQL Editor do Supabase e recarregue esta página.
        </div>
      ) : (
        <>
          <div className="adm-controls is-comments">
            <div className="adm-segment" role="tablist" aria-label="Filtro de comentários">
              {tabs.map((item) => (
                <button
                  type="button"
                  role="tab"
                  key={item.id}
                  aria-selected={tab === item.id}
                  className={tab === item.id ? "is-active" : ""}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                  {item.id === "pending" && pendingCount > 0 && <span className="adm-count">{pendingCount}</span>}
                </button>
              ))}
            </div>
            <label>
              Produto
              <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
                <option value="">Todos</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.title}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="admin-empty">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              {tab === "pending" ? "Nenhum comentário aguardando resposta. Tudo em dia." : "Nenhum comentário encontrado."}
            </div>
          ) : (
            <ul className="adm-thread-list">
              {filtered.map(({ root, replies }) => (
                <li key={root.id} className={`adm-thread ${root.status === "hidden" ? "is-hidden" : ""}`}>
                  <header className="adm-thread-head">
                    <div>
                      <strong>{root.lesson?.title || "Aula removida"}</strong>
                      <small>{productsOf(root).map((product) => product.title).join(", ")}</small>
                    </div>
                    <RowActions
                      label="Ações do comentário"
                      primary={productsOf(root).length ? { label: "Ver na aula", to: `/admin/area-de-membros?produto=${(productsOf(root).find((product) => product.id === productFilter) || productsOf(root)[0]).id}&aula=${root.lesson_id}` } : undefined}
                      items={[
                        { label: root.status === "hidden" ? "Mostrar para os alunos" : "Ocultar dos alunos", disabled: busyId === root.id, onClick: () => toggleHidden(root) },
                        { label: "Excluir comentário", danger: true, disabled: busyId === root.id, onClick: () => remove(root) },
                      ]}
                    />
                  </header>

                  <div className="adm-thread-body">
                    <Comment item={root} own={false} />
                    {root.status === "hidden" && <span className="status-badge hidden">Oculto para os alunos</span>}
                    {replies.map((reply) => (
                      <div className="adm-reply" key={reply.id}>
                        <Comment item={reply} own={false} />
                        <button type="button" className="adm-link-danger" onClick={() => remove(reply)}>Excluir resposta</button>
                      </div>
                    ))}
                  </div>

                  <form
                    className="adm-reply-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendReply(root);
                    }}
                  >
                    <label>
                      Responder como instrutor
                      <textarea
                        rows={2}
                        maxLength={1500}
                        value={drafts[root.id] || ""}
                        onChange={(event) => setDrafts((current) => ({ ...current, [root.id]: event.target.value }))}
                        placeholder="Escreva sua resposta..."
                      />
                    </label>
                    <button type="submit" className="admin-button primary" disabled={busyId === root.id || !(drafts[root.id] || "").trim()}>
                      {busyId === root.id ? "Enviando..." : "Responder"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
