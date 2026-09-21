import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchOrderStatus, formatMoneyCents } from "../../services/checkoutApi";
import "../../styles/checkout.css";

const POLL_FAST_MS = 3000;
const POLL_SLOW_MS = 10000;
const POLL_GIVE_UP_MS = 30 * 60 * 1000; // depois disso paramos de consultar; o acesso é liberado sozinho na confirmação

export default function CheckoutThanksPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order") || "";
  const redirectStatus = params.get("redirect_status") || "";
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
        const data = await fetchOrderStatus(orderId);
        if (!active) return;
        setOrder(data);
        setError("");
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
  }, [orderId]);

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
          <span className="ck-lock">🔒 Compra segura</span>
        </div>
      </header>
      <main className="ck-main ck-main-single">
        <section className="ck-card ck-center ck-thanks" aria-live="polite">{body}</section>
      </main>
    </div>
  );
}
