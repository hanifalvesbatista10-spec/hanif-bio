import { planInstallments, useInstallmentSettings } from "../../services/installments";
import { usesInternalCheckout } from "../../services/productCheckout";
import "../../styles/installments.css";

const money = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Destaque "12x de R$ X" (com o juro do cartão) e o valor à vista. Não mostra nada se o admin não configurou
// o juro, se o produto não usa o checkout do site ou se o valor é baixo demais para parcelar.
export default function Installments({ product, cents, className = "" }) {
  const settings = useInstallmentSettings();
  const price = cents ?? Math.round(Number(product?.promotional_price ?? product?.price) * 100);
  if (cents === undefined && !usesInternalCheckout(product)) return null;
  const plan = planInstallments(price, settings);
  if (!plan) return null;

  return (
    <div className={`inst ${className}`.trim()}>
      <p className="inst-main">
        <strong>{plan.count}x</strong> de <strong>{money(plan.perCents)}</strong>
      </p>
      <p className="inst-sub">
        No cartão, {plan.withInterest ? `com juros (total ${money(plan.totalCents)})` : "sem juros"}. Ou {money(plan.cashCents)} à vista no Pix ou boleto.
      </p>
    </div>
  );
}
