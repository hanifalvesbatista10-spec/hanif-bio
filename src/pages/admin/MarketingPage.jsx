import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

const PUBLIC_SITE = "https://www.aphhardcore.com";

const money = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const siteOrigin = () => (typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.origin) ? window.location.origin : PUBLIC_SITE);

// Só dígitos; número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55. Vazio = o WhatsApp deixa escolher o contato.
function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

const dateBr = (value) => new Date(value).toLocaleDateString("pt-BR");

// O cupom só vale em produto com checkout do site, e só no produto dele quando é específico.
const couponApplies = (coupon, product) =>
  Boolean(coupon) && product.checkout_mode === "internal" && (!coupon.product_id || coupon.product_id === product.id);

const basePrice = (product) => Number(product.promotional_price ?? product.price);

// Prévia do preço com desconto (o valor de verdade é recalculado no servidor ao pagar).
function discountedPrice(coupon, product) {
  const base = basePrice(product);
  if (!Number.isFinite(base) || base <= 0) return null;
  const off = coupon.discount_type === "percent" ? (base * coupon.discount_value) / 100 : coupon.discount_value / 100;
  return Math.max(0, Math.round((base - off) * 100) / 100);
}

function couponLabel(coupon, productsById) {
  const value = coupon.discount_type === "percent" ? `${coupon.discount_value}%` : money(coupon.discount_value / 100);
  const scope = coupon.product_id ? productsById[coupon.product_id]?.title || "um produto" : "todos os cursos do site";
  return `${coupon.code} — ${value} de desconto (${scope})`;
}

function buildMessage({ products, clientName, includePrice, coupon }) {
  if (products.length === 0) return "";
  const origin = siteOrigin();
  const greeting = clientName.trim() ? `Olá, ${clientName.trim()}! Tudo bem? Aqui é o Hanif Alves.` : "Olá! Tudo bem? Aqui é o Hanif Alves.";
  const intro =
    products.length === 1
      ? "Separei uma formação que combina com o que você procura:"
      : `Separei ${products.length} formações que combinam com o que você procura:`;

  const blocks = products.map((product) => {
    const lines = [`*${product.title}*`];
    if (product.short_description) lines.push(product.short_description.trim());
    const highlights = (Array.isArray(product.highlights) ? product.highlights : []).filter(Boolean).slice(0, 3);
    highlights.forEach((item) => lines.push(`• ${item}`));
    const facts = [product.duration, product.format].filter(Boolean).join(" · ");
    if (facts) lines.push(facts);
    const price = product.promotional_price ?? product.price;
    if (includePrice && product.checkout_mode !== "whatsapp" && price !== null && price !== undefined && Number(price) > 0) {
      lines.push(`Investimento: ${money(price)}`);
    }
    lines.push(`Saiba mais: ${origin}/produto/${product.slug}`);
    if (couponApplies(coupon, product)) {
      const final = discountedPrice(coupon, product);
      if (includePrice && final !== null) {
        lines.push(`Com o cupom ${coupon.code}: de ${money(basePrice(product))} por ${final === 0 ? "grátis" : money(final)}`);
      }
      lines.push(`Garanta com o desconto: ${origin}/checkout/${product.slug}?cupom=${coupon.code}`);
    }
    return lines.join("\n");
  });

  const closing = [];
  if (products.some((product) => couponApplies(coupon, product))) {
    closing.push(`O cupom ${coupon.code} já vem aplicado no link${coupon.expires_at ? ` e vale até ${dateBr(coupon.expires_at)}` : ""}.`);
  }
  closing.push("Qualquer dúvida é só me chamar por aqui!");

  return [greeting, "", intro, "", blocks.join("\n\n"), "", closing.join("\n")].join("\n");
}

export default function MarketingPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [includePrice, setIncludePrice] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [couponId, setCouponId] = useState("");
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    supabase
      .from("products")
      .select("id,title,slug,short_description,highlights,duration,format,price,promotional_price,checkout_mode,status,display_order")
      .in("status", ["active", "unlisted"])
      .order("display_order", { ascending: true })
      .then(({ data, error: loadError }) => {
        if (loadError) setError(`Não foi possível carregar os produtos: ${loadError.message}`);
        else setProducts(data || []);
        setLoading(false);
      });
  }, []);

  // Cupons que ainda dá para usar hoje: ativos e dentro da validade (sem cupom cadastrado, a lista fica vazia).
  useEffect(() => {
    supabase
      .from("coupons")
      .select("id,code,discount_type,discount_value,product_id,starts_at,expires_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const today = Date.now();
        setCoupons((data || []).filter((c) => (!c.starts_at || new Date(c.starts_at).getTime() <= today) && (!c.expires_at || new Date(c.expires_at).getTime() >= today)));
      });
  }, []);

  const productsById = useMemo(() => Object.fromEntries(products.map((product) => [product.id, product])), [products]);
  const coupon = useMemo(() => coupons.find((item) => item.id === couponId) || null, [coupons, couponId]);
  const chosen = useMemo(() => products.filter((product) => selected.includes(product.id)), [products, selected]);
  const notCovered = coupon ? chosen.filter((product) => !couponApplies(coupon, product)) : [];
  const generated = useMemo(() => buildMessage({ products: chosen, clientName, includePrice, coupon }), [chosen, clientName, includePrice, coupon]);

  useEffect(() => {
    if (!edited) setMessage(generated);
  }, [generated, edited]);

  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const openWhatsapp = () => {
    const phone = normalizePhone(clientPhone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Mensagem copiada.");
    } catch {
      setNotice("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };

  const phoneTooShort = clientPhone.trim() !== "" && normalizePhone(clientPhone).length < 12;
  const canSend = message.trim() !== "" && !phoneTooShort;

  return (
    <section className="admin-section">
      <style>{`
        .mk-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:20px;align-items:start}
        .mk-card{background:#fff;border:1px solid #e0e7ee;border-radius:16px;padding:20px}
        .mk-card h3{margin:0 0 12px;font-size:1.05rem;color:#071426}
        .mk-list{display:grid;gap:8px;margin:0 0 16px}
        .mk-item{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid #e0e7ee;border-radius:12px;cursor:pointer;background:#fff}
        .mk-item.is-on{border-color:#d6152d;background:#fff5f6}
        .mk-item input{margin-top:3px;width:18px;height:18px;accent-color:#d6152d}
        .mk-item strong{display:block;color:#071426;font-size:.92rem}
        .mk-item small{color:#66798c}
        .mk-field{display:grid;gap:6px;margin-bottom:12px;font-size:.8rem;font-weight:800;color:#273d53}
        .mk-field select{width:100%;border:1px solid #d6e0e9;border-radius:11px;padding:11px 13px;font:inherit;font-weight:400;color:#13283c;background:#fff}
        .mk-field input,.mk-field textarea{width:100%;border:1px solid #d6e0e9;border-radius:11px;padding:11px 13px;font:inherit;font-weight:400;color:#13283c;background:#fff}
        .mk-field textarea{min-height:340px;resize:vertical;line-height:1.5}
        .mk-help{font-size:.74rem;font-weight:400;color:#7b8c9c}
        .mk-check{display:flex;gap:9px;align-items:center;font-size:.85rem;font-weight:700;color:#273d53;margin-bottom:12px}
        .mk-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
        .mk-wa{background:#1fa855;border:0;color:#fff}
        .mk-wa:disabled{opacity:.5;cursor:not-allowed}
        @media(max-width:900px){.mk-grid{grid-template-columns:1fr}.mk-field textarea{min-height:260px}}
      `}</style>

      <div className="admin-section-head">
        <div>
          <span>DIVULGAÇÃO</span>
          <h2>Marketing</h2>
        </div>
      </div>

      <p className="adm-hint">
        Escolha os cursos que quer apresentar, e o site monta uma mensagem curta explicando cada um, com o link da página. Você pode editar o texto
        e abrir direto no seu WhatsApp para enviar ao cliente.
      </p>

      {error && <div className="admin-alert error">{error}</div>}
      {notice && <div className="admin-alert" role="status">{notice}</div>}

      {loading ? (
        <div className="admin-empty">Carregando produtos...</div>
      ) : (
        <div className="mk-grid">
          <div className="mk-card">
            <h3>1. Cursos da mensagem</h3>
            <div className="mk-list">
              {products.map((product) => (
                <label key={product.id} className={`mk-item ${selected.includes(product.id) ? "is-on" : ""}`}>
                  <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
                  <span>
                    <strong>{product.title}</strong>
                    {product.status === "unlisted" && <small>Oculto no catálogo (só com link)</small>}
                  </span>
                </label>
              ))}
              {products.length === 0 && <span className="mk-help">Nenhum produto ativo para divulgar.</span>}
            </div>

            <h3>2. Cupom de desconto (opcional)</h3>
            <label className="mk-field">
              Cupom que você já criou em Cupons
              <select value={couponId} onChange={(e) => setCouponId(e.target.value)}>
                <option value="">Sem cupom</option>
                {coupons.map((item) => (
                  <option key={item.id} value={item.id}>{couponLabel(item, productsById)}</option>
                ))}
              </select>
              <span className="mk-help">
                {coupons.length === 0
                  ? "Nenhum cupom ativo. Crie um na aba Cupons."
                  : "O link de cada curso vai com o cupom já aplicado, e o preço com desconto aparece na mensagem."}
              </span>
              {notCovered.length > 0 && (
                <span className="mk-help" style={{ color: "#a60d25" }}>
                  Este cupom não vale para: {notCovered.map((product) => product.title).join(", ")}. Esses vão com o link normal.
                </span>
              )}
            </label>

            <h3>3. Cliente</h3>
            <label className="mk-field">
              Nome do cliente (opcional)
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex.: Maria" />
            </label>
            <label className="mk-field">
              WhatsApp do cliente (opcional)
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} inputMode="tel" placeholder="(88) 99999-9999" />
              <span className="mk-help">
                {phoneTooShort
                  ? "Número incompleto: digite o DDD e o número."
                  : "Se preencher, a conversa abre direto com esse cliente. Em branco, o WhatsApp deixa você escolher o contato."}
              </span>
            </label>
            <label className="mk-check">
              <input type="checkbox" checked={includePrice} onChange={(e) => setIncludePrice(e.target.checked)} />
              Mostrar o valor de cada curso
            </label>
          </div>

          <div className="mk-card">
            <h3>4. Mensagem</h3>
            <label className="mk-field">
              Texto que será enviado
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setEdited(true);
                }}
                placeholder="Marque ao menos um curso para a mensagem aparecer aqui."
              />
              <span className="mk-help">Pode editar à vontade. Os asteriscos deixam o título em negrito no WhatsApp.</span>
            </label>
            <div className="mk-actions">
              <button type="button" className="admin-button mk-wa" onClick={openWhatsapp} disabled={!canSend}>
                Abrir no WhatsApp
              </button>
              <button type="button" className="admin-button" onClick={copy} disabled={!message.trim()}>
                Copiar mensagem
              </button>
              {edited && (
                <button
                  type="button"
                  className="admin-button adm-ghost"
                  onClick={() => {
                    setEdited(false);
                    setMessage(generated);
                  }}
                >
                  Refazer a mensagem
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
