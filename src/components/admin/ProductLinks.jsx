import { useState } from "react";
import "../../styles/product-links.css";

const cleanCode = (value) => value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function LinkRow({ label, hint, url, copyLabel = "Copiar", noOpen }) {
  const [state, setState] = useState("");

  const copy = async () => {
    setState((await copyText(url)) ? "ok" : "erro");
    setTimeout(() => setState(""), 2200);
  };

  return (
    <div className="pl-row">
      <div className="pl-label">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
      <input className="pl-url" readOnly value={url} onFocus={(event) => event.target.select()} aria-label={label} />
      <div className="pl-actions">
        <button type="button" className="pl-btn" onClick={copy}>
          {state === "ok" ? "Copiado" : state === "erro" ? "Copie à mão" : copyLabel}
        </button>
        {!noOpen && (
          <a className="pl-btn is-ghost" href={url} target="_blank" rel="noreferrer">
            Abrir
          </a>
        )}
      </div>
    </div>
  );
}

// Links prontos do produto salvo: página de apresentação, pagamento direto, com cupom e mensagem de WhatsApp.
export default function ProductLinks({ product }) {
  const [coupon, setCoupon] = useState("");
  const origin = window.location.origin;
  const page = `${origin}/produto/${product.slug}`;
  const internal = product.checkout_mode === "internal";
  const code = cleanCode(coupon);
  const pay = `${origin}/checkout/${product.slug}`;
  const isActive = product.status === "active";

  return (
    <section className="pl-card" aria-labelledby="pl-title">
      <h3 id="pl-title">Links deste produto</h3>
      <p className="pl-intro">
        Links prontos para colocar no Instagram, no WhatsApp ou em anúncios.
        {!isActive && <b> Este produto não está Ativo, então a página dele não abre para o público até você ativar.</b>}
      </p>

      <LinkRow label="Página de apresentação" hint="Mostra o produto, o preço e o botão de compra." url={page} />

      {internal ? (
        <>
          <LinkRow label="Pagamento direto" hint="Abre já na tela de compra, sem passar pela página do produto." url={pay} />
          <div className="pl-coupon">
            <label htmlFor="pl-coupon-input">Link de pagamento com cupom</label>
            <input
              id="pl-coupon-input"
              value={coupon}
              onChange={(event) => setCoupon(event.target.value)}
              placeholder="Digite o código do cupom, ex.: TURMA10"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {code && <LinkRow label={`Pagamento com o cupom ${code}`} hint="O desconto já vem aplicado quando a pessoa abre." url={`${pay}?cupom=${code}`} />}
        </>
      ) : (
        product.checkout_url && (
          <LinkRow label="Link de venda externo" hint="O mesmo endereço que o botão Comprar usa." url={product.checkout_url} />
        )
      )}

      <LinkRow
        label="Mensagem para WhatsApp"
        hint="Texto pronto com o link da página."
        url={`Conheça ${product.title}: ${page}`}
        copyLabel="Copiar mensagem"
        noOpen
      />
    </section>
  );
}
