import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { createCheckout, fetchOrderStatus, formatMoneyCents, formatPhone } from "../../services/checkoutApi";
import { formatCpf, isValidCpf } from "../../services/studentData";
import "../../styles/checkout.css";

const METHODS = [
  { id: "pix", title: "Pix", note: "Aprovação na hora", cta: "Gerar Pix" },
  { id: "boleto", title: "Boleto", note: "Compensa em até 2 dias úteis", cta: "Gerar boleto" },
  { id: "card", title: "Cartão de crédito", note: "Pagamento na página segura do Asaas", cta: "Pagar com cartão" },
];

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Depois de gerar o Pix, acompanha o pagamento e leva para a confirmação quando cair.
function PixPanel({ pix, orderId, amount }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    let timer;
    const tick = async () => {
      try {
        const data = await fetchOrderStatus(orderId);
        if (!active) return;
        if (data.status === "paid") {
          window.location.assign(`/checkout/obrigado?order=${orderId}`);
          return;
        }
        if (["failed", "canceled", "refunded"].includes(data.status)) return;
      } catch {
        /* tenta de novo */
      }
      timer = window.setTimeout(tick, 3000);
    };
    timer = window.setTimeout(tick, 3000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [orderId]);

  return (
    <div className="ck-method-panel">
      <h3>Pague {formatMoneyCents(amount)} com Pix</h3>
      <ol className="ck-steps">
        <li>Abra o app do seu banco e escolha pagar com Pix.</li>
        <li>Escaneie o QR code ou use o “Pix copia e cola”.</li>
        <li>Pronto: esta página confirma sozinha assim que o pagamento cair.</li>
      </ol>
      {pix.qrImage && <img className="ck-qr" src={`data:image/png;base64,${pix.qrImage}`} alt="QR code do Pix" />}
      <label className="ck-copy">
        Pix copia e cola
        <textarea readOnly rows={3} value={pix.payload} onFocus={(e) => e.target.select()} />
      </label>
      <button
        type="button"
        className="ck-primary"
        onClick={async () => {
          setCopied(await copyText(pix.payload));
          window.setTimeout(() => setCopied(false), 2500);
        }}
      >
        {copied ? "Código copiado!" : "Copiar código Pix"}
      </button>
      <p className="ck-note" role="status">Aguardando o pagamento…</p>
    </div>
  );
}

function BoletoPanel({ boleto, orderId, amount }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ck-method-panel">
      <h3>Boleto de {formatMoneyCents(amount)} gerado</h3>
      <p className="ck-help">
        Pague em qualquer banco ou app até o vencimento{boleto.dueDate ? ` (${new Date(`${boleto.dueDate}T12:00:00`).toLocaleDateString("pt-BR")})` : ""}.
        A compensação leva até 2 dias úteis; depois disso o seu acesso é liberado automaticamente.
      </p>
      <label className="ck-copy">
        Linha digitável
        <textarea readOnly rows={2} value={boleto.line || ""} onFocus={(e) => e.target.select()} />
      </label>
      <div className="ck-actions">
        <button
          type="button"
          className="ck-primary ck-link"
          onClick={async () => {
            setCopied(await copyText(boleto.line || ""));
            window.setTimeout(() => setCopied(false), 2500);
          }}
        >
          {copied ? "Copiado!" : "Copiar linha digitável"}
        </button>
        {boleto.url && <a className="ck-secondary ck-link" href={boleto.url} target="_blank" rel="noreferrer">Abrir o boleto (PDF)</a>}
      </div>
      <Link className="ck-back" to={`/checkout/obrigado?order=${orderId}`}>Acompanhar o meu pedido →</Link>
    </div>
  );
}

export default function CheckoutPage() {
  const { slug } = useParams();
  const { user, profile } = useAuth();
  const [product, setProduct] = useState(undefined); // undefined = carregando, null = não encontrado
  const [form, setForm] = useState({ name: "", email: "", cpf: "", phone: "" });
  const [method, setMethod] = useState("pix");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [payment, setPayment] = useState(null); // resposta de /api/checkout-create
  const panelRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    let active = true;
    supabase
      .from("products")
      .select("id,title,slug,short_description,cover_url,price,promotional_price,checkout_mode,checkout_url,status")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => active && setProduct(data && data.status === "active" ? data : null));
    return () => {
      active = false;
    };
  }, [slug]);

  // Quem já está logado (e tem os dados no perfil) não precisa digitar tudo de novo.
  useEffect(() => {
    if (!profile) return;
    setForm((current) => ({
      name: current.name || profile.full_name || "",
      email: current.email || profile.email || user?.email || "",
      cpf: current.cpf || profile.cpf || "",
      phone: current.phone || formatPhone(profile.phone || ""),
    }));
  }, [profile, user]);

  useEffect(() => {
    if (payment && panelRef.current) panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [payment]);

  const price = useMemo(() => {
    const promo = Number(product?.promotional_price);
    const base = Number(product?.price);
    const value = promo > 0 ? promo : base;
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
  }, [product]);
  const original = product && Number(product.promotional_price) > 0 && Number(product.price) > Number(product.promotional_price) ? Math.round(Number(product.price) * 100) : 0;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().split(/\s+/).filter(Boolean).length < 2) next.name = "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) next.email = "Informe um e-mail válido.";
    if (!isValidCpf(form.cpf)) next.cpf = "CPF inválido. Confira os números.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setApiError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await createCheckout({ slug, method, name: form.name, email: form.email, cpf: form.cpf, phone: form.phone });
      if (result.card?.url) {
        // cartão: segue para a página segura do Asaas (volta para cá depois de pago)
        window.location.assign(result.card.url);
        return;
      }
      setPayment(result);
    } catch (error) {
      setApiError(error.message);
    }
    setSubmitting(false);
  };

  if (product === undefined) {
    return <div className="ck-page"><p className="ck-note">Carregando...</p></div>;
  }

  if (product === null) {
    return (
      <div className="ck-page">
        <div className="ck-card ck-center">
          <h1>Produto não encontrado</h1>
          <p>Este produto não está disponível para compra no momento.</p>
          <Link className="ck-primary ck-link" to="/">Voltar ao site</Link>
        </div>
      </div>
    );
  }

  if (product.checkout_mode !== "internal") {
    return (
      <div className="ck-page">
        <div className="ck-card ck-center">
          <h1>{product.title}</h1>
          <p>Este produto é vendido em outra página.</p>
          {product.checkout_url && <a className="ck-primary ck-link" href={product.checkout_url} target="_blank" rel="noreferrer">Ir para a página de compra</a>}
          <Link className="ck-back" to={`/produto/${product.slug}`}>← Ver detalhes do produto</Link>
        </div>
      </div>
    );
  }

  const chosen = METHODS.find((item) => item.id === method) || METHODS[0];

  return (
    <div className="ck-page">
      <header className="ck-top">
        <div className="ck-top-inner">
          <Link to="/" className="ck-brand">HANIF ALVES<span>APH • URGÊNCIA • EMERGÊNCIA</span></Link>
          <span className="ck-lock">🔒 Compra segura</span>
        </div>
      </header>

      <main className="ck-main">
        <section className="ck-card ck-form-card" aria-label="Dados e pagamento">
          <h1>Finalizar compra</h1>

          {!payment ? (
            <form onSubmit={submit} noValidate>
              <h2>1. Seus dados</h2>
              <p className="ck-help">Use o e-mail que você usa (ou vai usar) para entrar na plataforma: é com ele que o seu acesso é liberado.</p>
              <label>Nome completo
                <input value={form.name} onChange={set("name")} autoComplete="name" aria-invalid={Boolean(errors.name)} />
                {errors.name && <small className="ck-error">{errors.name}</small>}
              </label>
              <label>E-mail
                <input type="email" value={form.email} onChange={set("email")} autoComplete="email" aria-invalid={Boolean(errors.email)} />
                {errors.email && <small className="ck-error">{errors.email}</small>}
              </label>
              <div className="ck-row">
                <label>CPF
                  <input value={form.cpf} onChange={(e) => setForm((current) => ({ ...current, cpf: formatCpf(e.target.value) }))} inputMode="numeric" placeholder="000.000.000-00" aria-invalid={Boolean(errors.cpf)} />
                  {errors.cpf && <small className="ck-error">{errors.cpf}</small>}
                </label>
                <label>WhatsApp (opcional)
                  <input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: formatPhone(e.target.value) }))} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" />
                </label>
              </div>

              <h2>2. Forma de pagamento</h2>
              <div className="ck-methods" role="radiogroup" aria-label="Forma de pagamento">
                {METHODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={method === item.id}
                    className={`ck-method ${method === item.id ? "is-active" : ""}`}
                    onClick={() => setMethod(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.note}</span>
                  </button>
                ))}
              </div>

              {apiError && <div className="ck-alert" role="alert">{apiError}</div>}
              <button className="ck-primary" type="submit" disabled={submitting || price === 0}>
                {submitting ? "Preparando o pagamento..." : `${chosen.cta} · ${formatMoneyCents(price)}`}
              </button>
              {price === 0 && <p className="ck-error">O preço deste produto ainda não foi configurado.</p>}
              <p className="ck-secure">Pagamento processado com segurança pelo Asaas. Nós não guardamos dados de cartão.</p>
            </form>
          ) : (
            <div ref={panelRef}>
              <div className="ck-buyer">
                <div><strong>{form.name}</strong><span>{form.email}</span></div>
                <button type="button" className="ck-link-button" onClick={() => setPayment(null)}>Alterar</button>
              </div>
              {payment.pix && <PixPanel pix={payment.pix} orderId={payment.orderId} amount={payment.amount} />}
              {payment.boleto && <BoletoPanel boleto={payment.boleto} orderId={payment.orderId} amount={payment.amount} />}
            </div>
          )}
        </section>

        <aside className="ck-card ck-summary" aria-label="Resumo do pedido">
          <h2>Resumo do pedido</h2>
          <div className="ck-product">
            {product.cover_url && <img src={product.cover_url} alt="" />}
            <div>
              <strong>{product.title}</strong>
              {product.short_description && <span>{product.short_description}</span>}
            </div>
          </div>
          <dl>
            {original > 0 && <div><dt>Valor</dt><dd><del>{formatMoneyCents(original)}</del></dd></div>}
            <div className="ck-total"><dt>Total</dt><dd>{formatMoneyCents(price)}</dd></div>
          </dl>
          <ul className="ck-perks">
            <li>Pix, boleto ou cartão de crédito</li>
            <li>Acesso liberado automaticamente após a confirmação</li>
          </ul>
          <Link className="ck-back" to={`/produto/${product.slug}`}>← Voltar ao produto</Link>
        </aside>
      </main>
    </div>
  );
}
