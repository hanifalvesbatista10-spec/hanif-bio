import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RowActions from "../../components/admin/RowActions";
import { supabase } from "../../services/supabase";
import { feedbackLinkUrl, feedbackMessage, linkState, whatsappShareUrl } from "../../services/feedbackLinks";
import "../../styles/forms-admin.css";

const STATUS = {
  draft: { label: "Rascunho", tone: "is-draft" },
  review: { label: "Em análise", tone: "is-review" },
  published: { label: "Publicado", tone: "is-published" },
  hidden: { label: "Oculto", tone: "is-draft" },
  archived: { label: "Arquivado", tone: "is-draft" },
};

const FILTERS = [
  ["all", "Todos"],
  ["review", "Em análise"],
  ["published", "Publicados"],
  ["draft", "Outros"],
];

const stars = (n) => "★".repeat(n || 0) + "☆".repeat(5 - (n || 0));

export default function FeedbacksPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [links, setLinks] = useState([]);
  const [linksReady, setLinksReady] = useState(true);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showLinks, setShowLinks] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ label: "", student_name: "", product_id: "", days: "", single: false });

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = useCallback(async () => {
    const [feedbacks, linkResult, productResult] = await Promise.all([
      supabase
        .from("student_feedbacks")
        .select("id,student_name,title,rating,status,publication_authorized,is_featured,testimonial_date,source,created_at,product:products(title)")
        .order("created_at", { ascending: false }),
      supabase.from("feedback_links").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id,title").order("title"),
    ]);
    if (feedbacks.error) notify("error", `Erro: ${feedbacks.error.message}`);
    else setRows(feedbacks.data || []);
    if (linkResult.error) setLinksReady(false);
    else {
      setLinksReady(true);
      setLinks(linkResult.data || []);
    }
    setProducts(productResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = rows.filter((row) => row.status === "review").length;

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "review" && row.status !== "review") return false;
      if (filter === "published" && row.status !== "published") return false;
      if (filter === "draft" && ["review", "published"].includes(row.status)) return false;
      return !term || `${row.student_name} ${row.title || ""}`.toLowerCase().includes(term);
    });
  }, [rows, filter, query]);

  const productTitle = (id) => products.find((item) => item.id === id)?.title || "";

  // ---------------- links
  const createLink = async (event) => {
    event.preventDefault();
    setCreating(true);
    const days = Number(form.days);
    const personal = form.student_name.trim();
    const { data, error } = await supabase
      .from("feedback_links")
      .insert({
        label: form.label.trim() || (personal ? `Depoimento de ${personal}` : "Link de depoimento"),
        student_name: personal || null,
        product_id: form.product_id || null,
        max_uses: personal || form.single ? 1 : null,
        expires_at: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
      })
      .select("*")
      .single();
    setCreating(false);
    if (error) return notify("error", `Não foi possível criar o link: ${error.message}`);
    setForm({ label: "", student_name: "", product_id: "", days: "", single: false });
    setLinks((current) => [data, ...current]);
    await copy(feedbackMessage({ name: data.student_name, product: productTitle(data.product_id), url: feedbackLinkUrl(data.token) }), "Link criado e a mensagem já está copiada. É só colar no WhatsApp.");
  };

  const copy = async (text, okText) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("success", okText);
    } catch {
      window.prompt("Copie:", text);
    }
  };

  const toggleLink = async (link) => {
    const { error } = await supabase.from("feedback_links").update({ active: !link.active }).eq("id", link.id);
    if (error) return notify("error", error.message);
    setLinks((current) => current.map((item) => (item.id === link.id ? { ...item, active: !link.active } : item)));
    notify("success", link.active ? "Link desligado: quem abrir vai ver que ele não vale mais." : "Link ligado de novo.");
  };

  const removeLink = async (link) => {
    if (!window.confirm(`Excluir o link "${link.label}"? Os depoimentos já recebidos continuam aqui.`)) return;
    const { error } = await supabase.from("feedback_links").delete().eq("id", link.id);
    if (error) return notify("error", error.message);
    setLinks((current) => current.filter((item) => item.id !== link.id));
    notify("success", "Link excluído.");
  };

  // ---------------- depoimentos
  const setStatus = async (row, status) => {
    const patch = { status };
    if (status === "published" && !row.publication_authorized) {
      if (!window.confirm(`${row.student_name} não marcou a autorização para publicar. Publicar mesmo assim? Use se ele(a) autorizou por outro meio, como WhatsApp.`)) return;
      patch.publication_authorized = true;
    }
    const { error } = await supabase.from("student_feedbacks").update(patch).eq("id", row.id);
    if (error) return notify("error", error.message);
    notify("success", status === "published" ? `Depoimento de ${row.student_name} publicado no site.` : "Situação atualizada.");
    load();
  };

  const remove = async (row) => {
    if (!window.confirm(`Excluir o depoimento de ${row.student_name} definitivamente?`)) return;
    const { error } = await supabase.from("student_feedbacks").delete().eq("id", row.id);
    if (error) return notify("error", error.message);
    notify("success", "Depoimento excluído.");
    load();
  };

  return (
    <section className="admin-section fa">
      <div className="fa-top">
        <div>
          <h2>Feedbacks</h2>
          <p className="fa-sub">
            Depoimentos dos alunos.
            {pending > 0 && ` ${pending} ${pending === 1 ? "espera" : "esperam"} a sua revisão.`}
          </p>
        </div>
        <div className="fa-top-actions">
          <button type="button" className="fa-btn is-ghost" aria-expanded={showLinks} onClick={() => setShowLinks((value) => !value)}>
            {showLinks ? "Fechar links" : "Pedir depoimento por link"}
          </button>
          <Link className="fa-btn" to="/admin/feedbacks/novo">+ Novo feedback</Link>
        </div>
      </div>

      {message && <div className={`fa-alert is-${messageType}`} role="status">{message}</div>}

      {showLinks && (
        <div className="fa-card">
          <h3>Pedir depoimento por link</h3>
          {!linksReady ? (
            <p className="fa-note">Para usar os links, rode <strong>supabase/24_depoimentos_por_link.sql</strong> no SQL Editor do Supabase.</p>
          ) : (
            <>
              <p className="fa-help" style={{ marginTop: 0 }}>
                Crie um link, mande para o aluno e ele preenche sozinho: nome, nota, depoimento e foto. Tudo chega aqui como <strong>Em análise</strong>; só vai ao site quando você publicar.
              </p>
              <form onSubmit={createLink}>
                <div className="fa-grid">
                  <label className="fa-field">
                    <span>Nome do aluno (opcional)</span>
                    <input className="fa-input" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} placeholder="Deixe em branco para um link geral" />
                    <small>Com nome, o link é pessoal: já vem com o nome e vale uma vez.</small>
                  </label>
                  <label className="fa-field">
                    <span>Curso</span>
                    <select className="fa-input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                      <option value="">Sem curso específico</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                    </select>
                  </label>
                  <label className="fa-field">
                    <span>Identificação (só você vê)</span>
                    <input className="fa-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex.: Turma de outubro" />
                  </label>
                  <label className="fa-field">
                    <span>Vale por quantos dias (opcional)</span>
                    <input className="fa-input" type="number" min="1" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} placeholder="Em branco = sem prazo" />
                  </label>
                </div>
                <div className="fa-actions" style={{ marginTop: 14 }}>
                  <button type="submit" className="fa-btn" disabled={creating}>{creating ? "Criando..." : "Criar link e copiar mensagem"}</button>
                </div>
              </form>

              {links.length > 0 && (
                <div className="fa-table-wrap" style={{ marginTop: 18 }}>
                  <table className="fa-table">
                    <thead>
                      <tr><th>Link</th><th>Curso</th><th>Usos</th><th>Situação</th><th className="is-end"><span className="ra-th">Ações</span></th></tr>
                    </thead>
                    <tbody>
                      {links.map((link) => {
                        const state = linkState(link);
                        const url = feedbackLinkUrl(link.token);
                        const text = feedbackMessage({ name: link.student_name, product: productTitle(link.product_id), url });
                        return (
                          <tr key={link.id}>
                            <td>
                              <strong>{link.label}</strong>
                              <small>{link.student_name ? `Pessoal · ${link.student_name}` : "Geral"}{link.expires_at ? ` · até ${new Date(link.expires_at).toLocaleDateString("pt-BR")}` : ""}</small>
                            </td>
                            <td>{productTitle(link.product_id) || "—"}</td>
                            <td className="is-num">{link.uses}{link.max_uses ? ` de ${link.max_uses}` : ""}</td>
                            <td><span className={`fa-pill ${state.tone}`}>{state.label}</span></td>
                            <td className="is-end">
                              <RowActions
                                label={`Ações do link ${link.label}`}
                                primary={{ label: "Copiar mensagem", onClick: () => copy(text, "Mensagem copiada. É só colar no WhatsApp.") }}
                                items={[
                                  { label: "Copiar só o link", onClick: () => copy(url, "Link copiado.") },
                                  { label: "Enviar pelo WhatsApp", href: whatsappShareUrl(text) },
                                  { label: "Abrir a página do aluno", href: url },
                                  { label: link.active ? "Desligar link" : "Ligar link", onClick: () => toggleLink(link) },
                                  { label: "Excluir link", danger: true, onClick: () => removeLink(link) },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="fa-toolbar">
        <div className="fa-seg" role="group" aria-label="Filtrar depoimentos">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}{value === "review" && pending > 0 ? ` (${pending})` : ""}
            </button>
          ))}
        </div>
        <input className="fa-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por aluno ou título…" aria-label="Buscar" />
      </div>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : shown.length === 0 ? (
        <div className="admin-empty">{rows.length === 0 ? "Nenhum depoimento ainda. Use “Pedir depoimento por link” e mande para os seus alunos." : "Nada neste filtro."}</div>
      ) : (
        <div className="fa-table-wrap">
          <table className="fa-table">
            <thead>
              <tr><th>Aluno</th><th>Curso</th><th>Nota</th><th>Situação</th><th className="is-end"><span className="ra-th">Ações</span></th></tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const status = STATUS[row.status] || STATUS.draft;
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.student_name}</strong>
                      <small>{row.title || "Sem título"}</small>
                      {row.source === "link" && <small>Recebido pelo link · {new Date(row.created_at).toLocaleDateString("pt-BR")}</small>}
                    </td>
                    <td>{row.product?.title || "—"}</td>
                    <td className="is-num" style={{ color: "#c98a05" }} aria-label={`${row.rating} de 5 estrelas`}>{stars(row.rating)}</td>
                    <td>
                      <span className={`fa-pill ${status.tone}`}>{status.label}</span>
                      <small>{row.publication_authorized ? "Autorizado a publicar" : "Sem autorização"}{row.is_featured ? " · destaque" : ""}</small>
                    </td>
                    <td className="is-end">
                      <RowActions
                        label={`Ações do depoimento de ${row.student_name}`}
                        primary={{ label: row.status === "review" ? "Revisar" : "Editar", onClick: () => navigate(`/admin/feedbacks/${row.id}`) }}
                        items={[
                          { label: "Publicar no site", hidden: row.status === "published", onClick: () => setStatus(row, "published") },
                          { label: "Tirar do site", hidden: row.status !== "published", onClick: () => setStatus(row, "hidden") },
                          { label: "Excluir depoimento", danger: true, onClick: () => remove(row) },
                        ]}
                      />
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
