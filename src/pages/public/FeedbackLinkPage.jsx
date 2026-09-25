import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { LINK_PROBLEMS, uploadFeedbackPhoto } from "../../services/feedbackLinks";
import { supabase } from "../../services/supabase";
import { preparePhoto } from "../../services/studentData";
import "../../styles/forms-run.css";
import "../../styles/forms-public.css";
import "../../styles/feedback-public.css";

const MIN = 20;
const MAX = 2500;

// Página que o aluno abre pelo link para deixar o depoimento. Tudo chega "Em análise" para o instrutor.
export default function FeedbackLinkPage() {
  const { token } = useParams();
  const fileRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", profession: "", city: "", title: "", testimonial: "", result_achieved: "", media_url: "", rating: 5, authorized: false, website: "" });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Deixe o seu depoimento";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    supabase.rpc("feedback_link_info", { p_token: token }).then(({ data, error: rpcError }) => {
      if (rpcError) setInfo({ valid: false, reason: "not_found" });
      else {
        setInfo(data);
        if (data?.student_name) setForm((current) => ({ ...current, name: data.student_name }));
      }
      setLoading(false);
    });
  }, [token]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Escolha uma imagem (JPG, PNG ou WebP).");
    if (file.size > 15 * 1024 * 1024) return setError("A foto é muito grande. Use uma de até 15 MB.");
    try {
      const blob = await preparePhoto(file);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
      setError("");
    } catch (photoError) {
      setError(photoError.message);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.name.trim().length < 2) return setError("Informe o seu nome.");
    if (form.testimonial.trim().length < MIN) return setError("Conte um pouco mais sobre a sua experiência (pelo menos 20 letras).");
    if (form.testimonial.length > MAX) return setError("O depoimento passou de 2500 letras. Resuma um pouco.");
    setSending(true);
    try {
      let photoUrl = null;
      if (photo) {
        try {
          photoUrl = await uploadFeedbackPhoto(token, photo);
        } catch {
          photoUrl = null; // sem a foto o depoimento ainda vale
        }
      }
      const { error: rpcError } = await supabase.rpc("submit_feedback_via_link", {
        p_token: token,
        p_data: { ...form, photo: photoUrl, name: form.name.trim(), testimonial: form.testimonial.trim() },
      });
      if (rpcError) throw rpcError;
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError.message || "Não foi possível enviar agora. Tente de novo.");
    }
    setSending(false);
  };

  if (loading) return <main className="pf-state">Carregando...</main>;

  if (!info?.valid) {
    const problem = LINK_PROBLEMS[info?.reason] || LINK_PROBLEMS.not_found;
    return (
      <main className="pf-state">
        <h1>{problem.title}</h1>
        <p>{problem.text}</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="pf-page">
        <div className="pf-shell">
          <div className="pf-success">
            <h1>Obrigado pelo seu depoimento!</h1>
            <p>Recebemos com carinho. Ele será lido pela equipe antes de aparecer no site.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pf-page">
      <div className="pf-shell">
        <header className="pf-hero">
          <span>Depoimento</span>
          <h1>{info.student_name ? `${info.student_name.split(" ")[0]}, conta como foi` : "Conta como foi a sua experiência"}</h1>
          <p>
            {info.product_title ? `Você fez ${info.product_title}. ` : ""}
            Leva uns 2 minutos. Suas palavras ajudam outras pessoas a decidir se o curso é para elas.
          </p>
        </header>

        <form className="fx fb-form" onSubmit={submit} noValidate>
          <section className="fx-card">
            <h2>Sobre você</h2>
            <div className="fb-photo-row">
              <button type="button" className="fb-photo" onClick={() => fileRef.current?.click()} aria-label={preview ? "Trocar foto" : "Enviar foto"}>
                {preview ? <img src={preview} alt="Sua foto" /> : <span>Foto<br />(opcional)</span>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
              <p className="fx-hint">Uma foto de rosto deixa o depoimento mais humano. Sem ela, tudo bem.</p>
            </div>
            <div className="fx-id">
              <label><span>Seu nome *</span><input className="fx-input" value={form.name} onChange={set("name")} autoComplete="name" /></label>
              <label><span>Profissão ou formação</span><input className="fx-input" value={form.profession} onChange={set("profession")} placeholder="Ex.: técnica de enfermagem" /></label>
              <label><span>Cidade</span><input className="fx-input" value={form.city} onChange={set("city")} autoComplete="address-level2" /></label>
            </div>
          </section>

          <section className="fx-card">
            <h2>Como você avalia?</h2>
            <div className="fb-stars" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`} className={n <= form.rating ? "is-on" : ""} onClick={() => setForm((current) => ({ ...current, rating: n }))}>
                  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.2 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.5l6.1-.7L12 3.2Z" /></svg>
                </button>
              ))}
            </div>
          </section>

          <section className="fx-card">
            <h2>Seu depoimento</h2>
            <label className="fb-label"><span>Uma frase de título (opcional)</span><input className="fx-input" value={form.title} onChange={set("title")} placeholder="Ex.: Mudou a forma como eu atendo" maxLength={140} /></label>
            <label className="fb-label">
              <span>O que você achou? *</span>
              <textarea className="fx-input fx-textarea" rows={7} value={form.testimonial} onChange={set("testimonial")} maxLength={MAX} placeholder="Conte o que aprendeu, o que mudou para você e para quem você recomendaria." />
              <small className="fx-hint">{form.testimonial.trim().length < MIN ? `Mais ${MIN - form.testimonial.trim().length} letras para poder enviar.` : `${form.testimonial.length}/${MAX}`}</small>
            </label>
            <label className="fb-label"><span>Algum resultado que você alcançou? (opcional)</span><textarea className="fx-input" rows={2} value={form.result_achieved} onChange={set("result_achieved")} maxLength={800} placeholder="Ex.: fui aprovada no concurso do SAMU" /></label>
            <label className="fb-label"><span>Link de um vídeo seu (opcional)</span><input className="fx-input" type="url" value={form.media_url} onChange={set("media_url")} placeholder="https://" /></label>
          </section>

          <section className="fx-card">
            <label className="fb-consent">
              <input type="checkbox" checked={form.authorized} onChange={(event) => setForm((current) => ({ ...current, authorized: event.target.checked }))} />
              <span>Autorizo o uso do meu depoimento, do meu nome e da minha foto no site e nas redes sociais. Posso pedir para retirar quando quiser.</span>
            </label>
            {!form.authorized && <p className="fx-hint">Se você não autorizar, o depoimento fica só com a equipe e não aparece no site.</p>}
          </section>

          {/* campo escondido: só robôs preenchem */}
          <div className="fb-trap" aria-hidden="true">
            <label>Site<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label>
          </div>

          {error && <div className="fx-error" role="alert">{error}</div>}
          <button className="fx-submit" type="submit" disabled={sending}>{sending ? "Enviando..." : "Enviar depoimento"}</button>
        </form>
      </div>
    </main>
  );
}
