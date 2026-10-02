import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabase";
import { checkCoupon, createCheckout, formatMoneyCents, formatPhone } from "../../services/checkoutApi";
import { formatCpf, isValidCpf } from "../../services/studentData";
import Installments from "../../components/ui/Installments";
import "../../styles/checkout.css";

const METHODS = [
  {
    id: "online",
    title: "Pix ou cartão",
    note: "Pix na hora, ou cartão em até 12x. Você escolhe na página segura da InfinitePay",
    cta: "Pagar",
  },
  { id: "boleto", title: "Boleto", note: "Compensa em até 2 dias úteis", cta: "Gerar boleto" },
];

const STAGES = [
  { id: "dados", label: "Dados" },
  { id: "pagamento", label: "Pagamento" },
  { id: "liberacao", label: "Liberação" },
];

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="11" width="15" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// Painel de triagem: as 3 etapas da compra acendem conforme avançam. É só leitura visual —
// não trava nada, o formulário continua sendo validado por completo só no envio.
function StageTrack({ stage }) {
  const activeIndex = STAGES.findIndex((item) => item.id === stage.active);
  const fillPercent = stage.active === "dados" ? 12 : stage.active === "pagamento" ? 55 : 90;
  return (
    <>
      <div className="ck-progress" role="presentation">
        <div className="ck-progress-fill" style={{ transform: `scaleX(${fillPercent / 100})` }} />
      </div>
      <div className="ck-stages" role="list" aria-label="Etapas da compra">
        {STAGES.map((item, index) => {
          const status = stage.done.includes(item.id) ? "is-done" : index === activeIndex ? "is-active" : "";
          return (
            <div className={`ck-stage ${status}`} role="listitem" key={item.id}>
              <span className="ck-stage-dot" aria-hidden="true">{stage.done.includes(item.id) ? <CheckIcon /> : index + 1}</span>
              <span className="ck-stage-label">{item.label}</span>
              {index < STAGES.length - 1 && <span className="ck-stage-rule" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [product, setProduct] = useState(undefined); // undefined = carregando, null = não encontrado
  const [bumps, setBumps] = useState([]);
  const [selectedBumps, setSelectedBumps] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", cpf: "", phone: "" });
  const [method, setMethod] = useState("online");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [payment, setPayment] = useState(null); // resposta de /api/checkout-create
  const panelRef = useRef(null);

  // Cupom de desconto: o site só mostra a prévia; o desconto de verdade é recalculado no servidor ao pagar.
  const [couponCode, setCouponCode] = useState((searchParams.get("cupom") || "").toUpperCase());
  const [coupon, setCoupon] = useState(null); // { code, label, discountCents, finalCents, free }
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [methodBlocked, setMethodBlocked] = useState(false); // o cupom digitado não vale para a forma de pagamento escolhida
  const autoApplied = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    let active = true;
    supabase
      .from("products")
      .select("id,title,slug,short_description,cover_url,price,promotional_price,checkout_mode,checkout_url,status")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => active && setProduct(data && ["active", "unlisted"].includes(data.status) ? data : null));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!product?.id) return;
    let active = true;
    supabase
      .from("product_bumps")
      .select("id,price_cents,bump:products!bump_product_id(id,title,short_description,cover_url)")
      .eq("product_id", product.id)
      .order("display_order")
      .then(({ data }) => active && setBumps((data || []).filter((row) => row.bump)));
    return () => {
      active = false;
    };
  }, [product?.id]);

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

  const applyCoupon = async (codeOverride, methodOverride) => {
    const code = String(codeOverride ?? couponCode).trim();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponError("");
    try {
      setCoupon(await checkCoupon({ slug, code, email: form.email, cpf: form.cpf, method: methodOverride || method }));
      setMethodBlocked(false);
    } catch (error) {
      setCoupon(null);
      setCouponError(error.message);
      setMethodBlocked(error.code === "coupon_wrong_method");
    }
    setCheckingCoupon(false);
  };

  // trocar a forma de pagamento confere o cupom de novo: alguns valem só para Pix/cartão ou só para boleto
  const chooseMethod = (next) => {
    if (next === method) return;
    setMethod(next);
    if (coupon) applyCoupon(coupon.code, next);
    else if (methodBlocked && couponCode.trim()) applyCoupon(couponCode, next);
  };

  const removeCoupon = () => {
    setMethodBlocked(false);
    setCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // link com cupom (/checkout/curso?cupom=CODIGO) já aplica ao abrir
  useEffect(() => {
    if (product && product.checkout_mode === "internal" && couponCode && !autoApplied.current) {
      autoApplied.current = true;
      applyCoupon(couponCode);
    }
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  const bumpTotal = useMemo(
    () => bumps.filter((row) => selectedBumps.includes(row.id)).reduce((sum, row) => sum + Number(row.price_cents || 0), 0),
    [bumps, selectedBumps]
  );
  const total = (coupon ? coupon.finalCents : price) + bumpTotal;

  const toggleBump = (bumpId) => {
    setSelectedBumps((current) => (current.includes(bumpId) ? current.filter((id) => id !== bumpId) : [...current, bumpId]));
  };
  const isFree = Boolean(coupon) && coupon.finalCents === 0 && bumpTotal === 0;

  // Painel de triagem: leitura visual do progresso, calculada com as mesmas regras do validate()
  // abaixo — nunca trava o preenchimento, só mostra onde o comprador está.
  const dadosOk =
    form.name.trim().split(/\s+/).filter(Boolean).length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) &&
    isValidCpf(form.cpf);
  const stage = {
    active: !dadosOk ? "dados" : !payment ? "pagamento" : "liberacao",
    done: [...(dadosOk ? ["dados"] : []), ...(payment ? ["pagamento"] : [])],
  };

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
      const bumpProductIds = bumps.filter((row) => selectedBumps.includes(row.id)).map((row) => row.bump.id);
      const result = await createCheckout({ slug, method, name: form.name, email: form.email, cpf: form.cpf, phone: form.phone, coupon: coupon?.code || "", bumps: bumpProductIds });
      if (result.free) {
        // cupom de 100%: acesso liberado na hora
        window.location.assign(`/checkout/obrigado?order=${result.orderId}`);
        return;
      }
      if (result.online?.url) {
        // Pix ou cartão: segue para a página segura da InfinitePay (volta para cá depois de pago)
        window.location.assign(result.online.url);
        return;
      }
      setPayment(result);
    } catch (error) {
      setApiError(error.message);
      if (String(error.code || "").startsWith("coupon") || error.code === "invalid_coupon") setCoupon(null);
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
          <span className="ck-lock"><LockIcon /> Compra segura</span>
        </div>
      </header>

      <main className="ck-main">
        <section className="ck-card ck-form-card" aria-label="Dados e pagamento">
          <h1>Finalizar compra</h1>
          <StageTrack stage={stage} />

          {!payment ? (
            <form onSubmit={submit} noValidate>
              <h2>Seus dados</h2>
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

              <h2>Forma de pagamento</h2>
              <div className="ck-methods" role="radiogroup" aria-label="Forma de pagamento">
                {METHODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={method === item.id}
                    className={`ck-method ${method === item.id ? "is-active" : ""}`}
                    onClick={() => chooseMethod(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.note}</span>
                  </button>
                ))}
              </div>

              <h2>Cupom de desconto</h2>
              {coupon ? (
                <div className="ck-coupon-applied" role="status">
                  <div>
                    <strong>Cupom {coupon.code} aplicado</strong>
                    <span>{coupon.free ? "Acesso grátis" : `Você economiza ${formatMoneyCents(coupon.discountCents)}`}</span>
                  </div>
                  <button type="button" className="ck-link-button" onClick={removeCoupon}>Remover</button>
                </div>
              ) : (
                <div className="ck-coupon">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                    placeholder="Digite o código do cupom"
                    aria-label="Código do cupom"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                  <button type="button" className="ck-secondary" onClick={() => applyCoupon()} disabled={checkingCoupon || !couponCode.trim()}>
                    {checkingCoupon ? "Verificando..." : "Aplicar"}
                  </button>
                </div>
              )}
              {couponError && <small className="ck-error" role="alert">{couponError}</small>}

              {apiError && <div className="ck-alert" role="alert">{apiError}</div>}
              <button className="ck-primary" type="submit" disabled={submitting || price === 0}>
                {submitting ? "Preparando o pagamento..." : isFree ? "Liberar meu acesso grátis" : `${chosen.cta} · ${formatMoneyCents(total)}`}
              </button>
              {price === 0 && <p className="ck-error">O preço deste produto ainda não foi configurado.</p>}
              <p className="ck-secure">Pagamento processado com segurança. Nós não guardamos dados de cartão.</p>
            </form>
          ) : (
            <div ref={panelRef}>
              <div className="ck-buyer">
                <div><strong>{form.name}</strong><span>{form.email}</span></div>
                <button type="button" className="ck-link-button" onClick={() => setPayment(null)}>Alterar</button>
              </div>
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
            {coupon && coupon.discountCents > 0 && <div><dt>Cupom {coupon.code}</dt><dd className="ck-discount">− {formatMoneyCents(coupon.discountCents)}</dd></div>}
            {bumps.filter((row) => selectedBumps.includes(row.id)).map((row) => (
              <div key={row.id}><dt>{row.bump.title}</dt><dd>+ {formatMoneyCents(row.price_cents)}</dd></div>
            ))}
            <div className="ck-total"><dt>Total</dt><dd>{formatMoneyCents(total)}</dd></div>
          </dl>
          {total > 0 && <Installments cents={total} className="ck-inst" />}
          <ul className="ck-perks">
            <li>Pix, cartão de crédito (parcelado) ou boleto</li>
            <li>Acesso liberado automaticamente após a confirmação</li>
          </ul>

          {bumps.length > 0 && (
            <div className="ck-kit">
              <span className="ck-kit-head">Equipamento adicional</span>
              {bumps.map((row) => {
                const active = selectedBumps.includes(row.id);
                return (
                  <label key={row.id} className={`ck-kit-item ${active ? "is-active" : ""}`}>
                    <input type="checkbox" className="ck-kit-check" checked={active} onChange={() => toggleBump(row.id)} />
                    {row.bump.cover_url ? (
                      <img className="ck-kit-thumb" src={row.bump.cover_url} alt="" />
                    ) : (
                      <span className="ck-kit-thumb ck-kit-thumb-fallback" aria-hidden="true">{row.bump.title.trim().charAt(0).toUpperCase()}</span>
                    )}
                    <div className="ck-kit-info">
                      <strong>{row.bump.title}</strong>
                      {row.bump.short_description && <span>{row.bump.short_description}</span>}
                    </div>
                    <div className="ck-kit-side">
                      <span className="ck-kit-price">+ {formatMoneyCents(row.price_cents)}</span>
                      <span className="ck-kit-toggle" aria-hidden="true">{active ? <CheckIcon /> : <PlusIcon />}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <Link className="ck-back" to={`/produto/${product.slug}`}>← Voltar ao produto</Link>
        </aside>
      </main>
    </div>
  );
}
