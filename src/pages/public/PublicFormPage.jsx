import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import FormRunner from "../../components/forms/FormRunner";
import { enterExamFullscreen } from "../../components/forms/useExamGuard";
import { formatScore, typeLabel } from "../../services/forms";
import { supabase } from "../../services/supabase";
import "../../styles/forms-public.css";

// Formulário aberto ao público (pesquisas, coleta de informações). Provas de alunos abrem dentro da área do aluno.
export default function PublicFormPage() {
  const { slug } = useParams();
  const [form, setForm] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [startedAt] = useState(() => new Date().toISOString());
  const [run, setRun] = useState(null); // prova com tempo ou modo prova: { startedAtMs, identity } depois que a pessoa começa
  const [intro, setIntro] = useState({ name: "", email: "" });
  const [introError, setIntroError] = useState("");

  const [savedToken, setSavedToken] = useState(null); // código do resultado da última resposta enviada neste aparelho
  const [copied, setCopied] = useState(false);

  const startKey = (formId) => `fx-pub-start-${formId}`;
  const resultKey = (formId) => `fx-pub-result-${formId}`;
  const resultUrl = (token) => `${window.location.origin}/f/${form.slug}/resultado/${token}`;

  const copyLink = async (token) => {
    try {
      await navigator.clipboard.writeText(resultUrl(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link do seu resultado:", resultUrl(token));
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: row } = await supabase.from("forms").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
      if (!row) {
        setMessage("Este formulário não está disponível.");
        setLoading(false);
        return;
      }
      setForm(row);
      try {
        const last = JSON.parse(window.localStorage.getItem(resultKey(row.id)) || "null");
        if (last?.token) setSavedToken(last.token);
      } catch {
        /* sem armazenamento: sem o aviso de "você já respondeu" */
      }
      // prova que já foi começada neste aparelho: retoma de onde parou (o tempo não reinicia)
      if (row.settings?.exam_mode || row.time_limit_minutes) {
        try {
          const saved = JSON.parse(window.localStorage.getItem(startKey(row.id)) || "null");
          if (saved?.startedAtMs && saved?.identity) setRun(saved);
        } catch {
          /* sem armazenamento: começa do zero */
        }
      }
      if (row.audience !== "students") {
        const { data: list, error } = await supabase.from("form_blocks").select("*").eq("form_id", row.id).order("position");
        if (error) setMessage(error.message);
        else setBlocks(list || []);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const begin = () => {
    const settings = form.settings || {};
    const name = intro.name.trim();
    const email = intro.email.trim();
    if (settings.require_name && !name) return setIntroError("Informe o seu nome.");
    if ((settings.require_email || settings.one_per_email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setIntroError("Informe um e-mail válido.");
    setIntroError("");
    const started = { startedAtMs: Date.now(), identity: { name, email } };
    try {
      window.localStorage.setItem(startKey(form.id), JSON.stringify(started));
    } catch {
      /* sem armazenamento: a prova roda, mas não retoma se a página recarregar */
    }
    if (settings.exam_mode) enterExamFullscreen();
    setRun(started);
    window.scrollTo({ top: 0 });
  };

  const send = async (answers, { identity, exam }) => {
    setSending(true);
    setMessage("");
    const startedIso = run?.startedAtMs ? new Date(run.startedAtMs).toISOString() : startedAt;
    const { data, error } = await supabase.rpc("submit_public_form", {
      p_form_id: form.id,
      p_respondent: { name: identity.name.trim(), email: identity.email.trim(), started_at: startedIso, ...(exam ? { exam } : {}) },
      p_answers: answers,
    });
    setSending(false);
    if (error) {
      setMessage(error.message || "Não foi possível enviar.");
      return false;
    }
    try {
      window.localStorage.removeItem(startKey(form.id));
      if (data?.result_token) window.localStorage.setItem(resultKey(form.id), JSON.stringify({ token: data.result_token, at: Date.now() }));
    } catch {
      /* ignora */
    }
    setResult(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  };

  if (loading) return <main className="pf-state">Carregando...</main>;
  if (!form) return <main className="pf-state"><h1>Indisponível</h1><p>{message}</p></main>;
  if (form.audience === "students") return <Navigate to={`/minha-area/atividades/${form.slug}`} replace />;

  if (result) {
    const showScore = Boolean(form.settings?.show_score) && !result.pending_manual && Number(result.max_score) > 0;
    return (
      <main className="pf-page">
        <div className="pf-shell">
          <div className="pf-success">
            <h1>Obrigado por participar</h1>
            <p>Suas respostas foram registradas.</p>
            {showScore && (
              <div className="pf-score">
                <strong>{formatScore(result.score)} / {formatScore(result.max_score)}</strong>
                <small>pontuação</small>
              </div>
            )}
            {result.result_token && (
              <div className="pf-link">
                <h2>Veja suas respostas depois</h2>
                <p>Guarde este link. Com ele você volta aqui para ver seus acertos e erros{form.settings?.show_key === false ? "" : ", o gabarito e os comentários"} assim que o resultado for liberado.</p>
                <input className="pf-link-input" readOnly value={resultUrl(result.result_token)} onFocus={(e) => e.target.select()} aria-label="Link do seu resultado" />
                <div className="pf-link-actions">
                  <button type="button" className="pf-link-copy" onClick={() => copyLink(result.result_token)}>{copied ? "Link copiado" : "Copiar link"}</button>
                  <Link className="pf-link-open" to={`/f/${form.slug}/resultado/${result.result_token}`}>Ver meu resultado agora</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  const settings = form.settings || {};
  const returnBanner = savedToken ? (
    <div className="pf-return" role="note">
      <span>Você já enviou esta prova neste aparelho.</span>
      <Link to={`/f/${form.slug}/resultado/${savedToken}`}>Ver meu resultado</Link>
    </div>
  ) : null;
  const gated = Boolean(settings.exam_mode || form.time_limit_minutes);
  const maxExits = Number(settings.exam_max_exits) || 3;

  // prova com tempo ou modo prova: antes de abrir as perguntas, regras + identificação
  if (gated && !run) {
    const rules = [
      form.time_limit_minutes ? `Você tem ${form.time_limit_minutes} minutos depois de começar. Ao acabar o tempo, o envio é automático.` : null,
      settings.exam_mode ? `Fique nesta tela até terminar. Cada vez que você sair (trocar de aba ou de aplicativo, ou recarregar a página) é registrado, e na saída número ${maxExits} a prova é encerrada e enviada com o que já estiver respondido.` : null,
      settings.exam_mode ? "Não é possível copiar o texto das perguntas." : null,
      settings.one_per_email ? "Cada e-mail responde uma única vez." : null,
    ].filter(Boolean);
    return (
      <main className="pf-page">
        <div className="pf-shell">
          <header className="pf-hero">
            <span>{typeLabel(form.type)}</span>
            <h1>{form.title}</h1>
            {form.description && <p>{form.description}</p>}
          </header>
          {returnBanner}
          <section className="fx">
            <div className="fx-card">
              <h2>Antes de começar</h2>
              <ul className="pf-rules">{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
              <div className="fx-id">
                {settings.require_name && (
                  <label><span>Nome *</span><input className="fx-input" value={intro.name} onChange={(e) => setIntro((v) => ({ ...v, name: e.target.value }))} autoComplete="name" /></label>
                )}
                {(settings.require_email || settings.one_per_email) && (
                  <label><span>E-mail *</span><input className="fx-input" type="email" value={intro.email} onChange={(e) => setIntro((v) => ({ ...v, email: e.target.value }))} autoComplete="email" /></label>
                )}
              </div>
              {introError && <div className="fx-error" role="alert">{introError}</div>}
              <button type="button" className="fx-submit" onClick={begin}>Começar a prova</button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="pf-page">
      <div className="pf-shell">
        <header className="pf-hero">
          <span>{typeLabel(form.type)}</span>
          <h1>{form.title}</h1>
          {form.description && <p>{form.description}</p>}
        </header>
        {returnBanner}
        <FormRunner
          form={form}
          blocks={blocks}
          mode="public"
          onSubmit={send}
          sending={sending}
          error={message}
          startedAtMs={gated ? run?.startedAtMs : null}
          presetIdentity={gated ? run?.identity : null}
        />
      </div>
    </main>
  );
}
