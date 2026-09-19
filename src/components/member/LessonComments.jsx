import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";

export function isMissingCommentsTable(error) {
  const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return text.includes("lesson_comments") || text.includes("does not exist") || text.includes("42p01") || text.includes("pgrst205");
}

export function formatCommentDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function initials(name = "Aluno") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

// Comentários da aula, como o aluno enxerga: comentários principais e as respostas do instrutor.
export default function LessonComments({ lessonId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!lessonId) return;
    const { data, error: loadError } = await supabase
      .from("lesson_comments")
      .select("id,user_id,parent_id,author_name,author_role,body,status,created_at")
      .eq("lesson_id", lessonId)
      .eq("status", "visible")
      .order("created_at", { ascending: true });

    if (loadError) {
      // Sem a migration 13 a seção simplesmente não aparece para o aluno.
      setUnavailable(isMissingCommentsTable(loadError));
      setComments([]);
    } else {
      setUnavailable(false);
      setComments(data || []);
    }
    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    setLoading(true);
    setText("");
    setError("");
    load();
  }, [load]);

  const threads = useMemo(() => {
    const roots = comments.filter((item) => !item.parent_id);
    return roots.map((root) => ({ root, replies: comments.filter((item) => item.parent_id === root.id) }));
  }, [comments]);

  const submit = async (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    setSending(true);
    setError("");
    const { error: insertError } = await supabase
      .from("lesson_comments")
      .insert({ lesson_id: lessonId, user_id: user.id, body });
    if (insertError) {
      setError("Não foi possível enviar seu comentário agora. Tente novamente.");
    } else {
      setText("");
      await load();
    }
    setSending(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir seu comentário?")) return;
    const { error: deleteError } = await supabase.from("lesson_comments").delete().eq("id", id);
    if (deleteError) setError("Não foi possível excluir o comentário.");
    else await load();
  };

  if (unavailable) return null;

  return (
    <section className="member-comments" aria-labelledby="member-comments-title">
      <h3 id="member-comments-title">Comentários</h3>

      <form className="member-comment-form" onSubmit={submit}>
        <label htmlFor="member-comment-text" className="member-sr-only">Escreva um comentário ou dúvida sobre esta aula</label>
        <textarea
          id="member-comment-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1500}
          rows={3}
          placeholder="Escreva sua dúvida ou comentário sobre esta aula..."
        />
        <div className="member-comment-actions">
          <small>{text.length}/1500</small>
          <button type="submit" disabled={sending || !text.trim()}>
            {sending ? "Enviando..." : "Comentar"}
          </button>
        </div>
        {error && <p className="member-comment-error" role="alert">{error}</p>}
      </form>

      {loading ? (
        <p className="member-comment-empty">Carregando comentários...</p>
      ) : threads.length === 0 ? (
        <p className="member-comment-empty">Ainda não há comentários nesta aula. Seja o primeiro a comentar.</p>
      ) : (
        <ul className="member-thread-list">
          {threads.map(({ root, replies }) => (
            <li key={root.id} className="member-thread">
              <Comment item={root} own={root.user_id === user?.id} onRemove={remove} />
              {replies.map((reply) => (
                <div className="member-reply" key={reply.id}>
                  <Comment item={reply} own={false} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Comment({ item, own, onRemove }) {
  const isAdmin = item.author_role === "admin";
  return (
    <article className={`member-comment ${isAdmin ? "is-admin" : ""}`}>
      <span className="member-avatar" aria-hidden="true">{initials(item.author_name)}</span>
      <div className="member-comment-body">
        <header>
          <strong>{item.author_name}</strong>
          {isAdmin && <em className="member-badge">Instrutor</em>}
          <time dateTime={item.created_at}>{formatCommentDate(item.created_at)}</time>
        </header>
        <p>{item.body}</p>
        {own && onRemove && (
          <button type="button" className="member-link-button" onClick={() => onRemove(item.id)}>Excluir</button>
        )}
      </div>
    </article>
  );
}
