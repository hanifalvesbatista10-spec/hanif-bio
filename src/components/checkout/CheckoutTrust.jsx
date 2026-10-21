import { useCallback, useEffect, useState } from "react";

const TOTAL_MS = 15 * 60 * 1000;

function ShieldIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4.5 6v5.5c0 4.4 3 7.6 7.5 9.5 4.5-1.9 7.5-5.1 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </svg>
  );
}

function LockIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="11" width="15" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const storageKey = (slug) => `ha_ck_timer_${slug}`;

// A contagem de cada produto fica guardada na aba (sessionStorage): recarregar a página continua de onde parou, e uma visita
// nova (aba nova, ou contagem já vencida) começa outra de 15 minutos.
function startDeadline(slug) {
  try {
    const stored = Number(sessionStorage.getItem(storageKey(slug)));
    if (stored > Date.now()) return stored;
  } catch {
    // sem armazenamento: a contagem só vale enquanto a página está aberta
  }
  const next = Date.now() + TOTAL_MS;
  try {
    sessionStorage.setItem(storageKey(slug), String(next));
  } catch {
    // idem
  }
  return next;
}

// Faixa com o cronômetro de 15 minutos. É um lembrete VISUAL de quanto tempo levar para concluir: não muda preço, cupom nem
// o que o comprador consegue fazer quando chega a zero (a página só oferece renovar a contagem).
export function CheckoutTimer({ slug }) {
  const [deadline, setDeadline] = useState(() => startDeadline(slug));
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    // ao voltar para a aba, atualiza na hora (os intervalos ficam lentos com a aba em segundo plano)
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deadline]);

  const renew = useCallback(() => {
    const next = Date.now() + TOTAL_MS;
    try {
      sessionStorage.setItem(storageKey(slug), String(next));
    } catch {
      // sem armazenamento
    }
    setDeadline(next);
  }, [slug]);

  const expired = remaining <= 0;
  const minutes = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div className={`ck-timer${expired ? " is-expired" : ""}`} role="timer">
      {expired ? (
        <>
          <span>Sua reserva terminou. O preço e o cupom continuam os mesmos.</span>
          <button type="button" onClick={renew}>Renovar reserva</button>
        </>
      ) : (
        <>
          <span>Reserva do seu pedido</span>
          <strong aria-label={`${Number(minutes)} minutos e ${Number(seconds)} segundos`}>{minutes}:{seconds}</strong>
        </>
      )}
    </div>
  );
}

// Dois selos ao lado do botão de pagar.
export function TrustSeals() {
  return (
    <div className="ck-seals">
      <div className="ck-seal">
        <ShieldIcon />
        <span>
          <strong>Garantia de 7 dias</strong>
          <small>Se não gostar, devolvemos o seu dinheiro.</small>
        </span>
      </div>
      <div className="ck-seal">
        <LockIcon />
        <span>
          <strong>Compra segura</strong>
          <small>Pix, cartão e boleto. Não guardamos dados de cartão.</small>
        </span>
      </div>
    </div>
  );
}

// Selo maior no resumo do pedido.
export function GuaranteeBadge() {
  return (
    <div className="ck-guarantee">
      <ShieldIcon size={30} />
      <div>
        <strong>Garantia de 7 dias</strong>
        <p>Compre sem risco: se não for o que você esperava, peça o reembolso em até 7 dias após a compra e devolvemos o valor.</p>
      </div>
    </div>
  );
}
