import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchOrderStatus, formatMoneyCents } from "../../services/checkoutApi";
import { reportPurchaseConversion } from "../../services/adsConversion";
import { reportMetaPurchase } from "../../services/metaPixel";
import "../../styles/checkout.css";

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="11" width="15" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.43 15.1L2 22l5.05-1.32A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.2 15.03l-.3-.18-2.99.78.8-2.92-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 4.2c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15 0 1.26.92 2.48 1.05 2.65.13.17 1.78 2.83 4.4 3.85 2.17.85 2.62.68 3.09.64.47-.04 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.23-.17-.49-.3-.26-.13-1.52-.75-1.75-.83-.24-.09-.4-.13-.58.13-.17.26-.67.83-.82 1-.15.17-.3.2-.56.07-.26-.13-1.1-.4-2.1-1.3-.77-.69-1.3-1.55-1.45-1.8-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.4-.8-1.92-.2-.5-.42-.43-.58-.44h-.5Z" />
    </svg>
  );
}

const POLL_FAST_MS = 3000;
const POLL_SLOW_MS = 10000;
const POLL_GIVE_UP_MS = 30 * 60 * 1000; // depois disso paramos de consultar; o acesso é liberado sozinho na confirmação

export default function CheckoutThanksPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order") || "";
  const redirectStatus = params.get("redirect_status") || "";
  // a InfinitePay devolve estes dados na volta; com eles o servidor confere o pagamento na hora
  const returned = { transaction_nsu: params.get("transaction_nsu") || "", slug: params.get("slug") || "" };
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [gaveUp, setGaveUp] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!orderId) return undefined;
    let active = true;
    let timer;
    const tick = async () => {
      try {
        const data = await fetchOrderStatus(orderId, returned);
        if (!active) return;
        setOrder(data);
        setError("");
        if (data.status === "paid") {
          reportPurchaseConversion(orderId);
          // Pixel da Meta: mesmo eventID do servidor (id do pedido), então a Meta conta uma venda só
          reportMetaPurchase({ orderId, amountCents: data.amount, contentIds: data.contentIds });
        }
        if (["paid", "failed", "canceled", "refunded"].includes(data.status)) return;
      } catch (err) {
        if (!active) return;
        if (err.status === 404 || err.status === 400) {
          setError("Não encontramos este pedido.");
          return;
        }
        setError("Não foi possível consultar o pagamento agora. Vamos tentar de novo.");
      }
      const elapsed = Date.now() - startedAt.current;
      if (elapsed > POLL_GIVE_UP_MS) {
        setGaveUp(true);
        return;
      }
      timer = window.setTimeout(tick, elapsed > 60000 ? POLL_SLOW_MS : POLL_FAST_MS);
    };
    tick();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [orderId, returned.transaction_nsu, returned.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = order?.status;
  const failedRedirect = redirectStatus === "failed";

  let body;
  if (!orderId || error === "Não encontramos este pedido.") {
    body = (
      <>
        <h1>Pedido não encontrado</h1>
        <p>Confira o link ou fale com a gente pelo WhatsApp.</p>
        <Link className="ck-primary ck-link" to="/">Voltar ao site</Link>
      </>
    );
  } else if (!order) {
    body = <p className="ck-note" role="status">Verificando o seu pagamento...</p>;
  } else if (status === "paid") {
    body = (
      <>
        <div className="ck-badge is-ok" aria-hidden="true">✓</div>
        <h1>Pagamento confirmado!</h1>
        <p>Obrigado pela compra de <strong>{order.productTitle}</strong> ({formatMoneyCents(order.amount)}).</p>
        {order.groupLinks?.length > 0 && (
          <div className="ck-group">
            <h2>Entre no grupo do WhatsApp</h2>
            <p>É por lá que saem os avisos, os links dos encontros e as combinações com a turma.</p>
            <div className="ck-group-list">
              {order.groupLinks.map((group) => (
                <a key={group.url} className="ck-group-btn" href={group.url} target="_blank" rel="noopener noreferrer">
                  <WhatsappIcon />
                  <span>{order.groupLinks.length > 1 && group.title ? `Grupo: ${group.title}` : "Entrar no grupo"}</span>
                </a>
              ))}
            </div>
            <small>O link também fica guardado na sua área do aluno e no e-mail da compra.</small>
          </div>
        )}
        {user || order.hasAccount ? (
          <>
            <p>O seu acesso já está liberado na área do aluno.</p>
            <Link className="ck-primary ck-link" to="/minha-area">Acessar meus cursos</Link>
          </>
        ) : (
          <>
            <p>
              Para entrar, <strong>crie a sua conta</strong> com o mesmo e-mail da compra ({order.emailHint}). Assim que a conta existir, o
              curso aparece sozinho na sua área. Se você já tem conta com esse e-mail, é só entrar.
            </p>
            <div className="ck-actions">
              <Link className="ck-primary ck-link" to="/cadastro">Criar minha conta</Link>
              <Link className="ck-secondary ck-link" to="/login">Já tenho conta</Link>
            </div>
          </>
        )}
      </>
    );
  } else if (status === "failed" || status === "canceled" || failedRedirect) {
    body = (
      <>
        <div className="ck-badge is-bad" aria-hidden="true">!</div>
        <h1>O pagamento não foi concluído</h1>
        <p>Nenhum valor foi cobrado. Você pode tentar de novo com outra forma de pagamento.</p>
        {order.productSlug && <Link className="ck-primary ck-link" to={`/checkout/${order.productSlug}`}>Tentar novamente</Link>}
      </>
    );
  } else if (status === "refunded") {
    body = (
      <>
        <h1>Pedido reembolsado</h1>
        <p>O valor deste pedido foi devolvido. Se tiver dúvidas, fale com a gente.</p>
        <Link className="ck-primary ck-link" to="/">Voltar ao site</Link>
      </>
    );
  } else {
    body = (
      <>
        <div className="ck-badge is-wait" aria-hidden="true">…</div>
        <h1>Aguardando a confirmação</h1>
        <p>Pedido de <strong>{order.productTitle}</strong> ({formatMoneyCents(order.amount)}).</p>
        <ul className="ck-perks ck-wait-list">
          <li><strong>Pix:</strong> assim que o pagamento cair, esta página atualiza sozinha.</li>
          <li><strong>Boleto:</strong> pode levar até 2 dias úteis para compensar. Quando confirmar, o acesso é liberado sozinho.</li>
          <li><strong>Cartão:</strong> a confirmação costuma levar poucos segundos.</li>
        </ul>
        {gaveUp && <p className="ck-note">Paramos de atualizar esta página. Quando o pagamento for confirmado, o acesso é liberado sozinho. É só entrar na sua conta.</p>}
        {error && !gaveUp && <p className="ck-note">{error}</p>}
      </>
    );
  }

  return (
    <div className="ck-page">
      <header className="ck-top">
        <div className="ck-top-inner">
          <Link to="/" className="ck-brand">HANIF ALVES<span>APH • URGÊNCIA • EMERGÊNCIA</span></Link>
          <span className="ck-lock"><LockIcon /> Compra segura</span>
        </div>
      </header>
      <main className="ck-main ck-main-single">
        <section className="ck-card ck-center ck-thanks" aria-live="polite">{body}</section>
      </main>
    </div>
  );
}
