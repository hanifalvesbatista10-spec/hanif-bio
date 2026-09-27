// Parcelamento em destaque ("12x de R$ 27,90"), já com o juro que o comprador paga no cartão.
// O juro é o total que a InfinitePay repassa em N parcelas, informado pelo admin (site_settings, SQL 28).
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const MIN_INSTALLMENT_CENTS = 500; // abaixo disso não se anuncia parcela
const MIN_PRICE_CENTS = 1000;

let pending = null;

// Devolve { feePercent, max } ou null (destaque desligado, SQL 28 não rodou ou erro): nesse caso nada é mostrado.
export function loadInstallmentSettings(force = false) {
  if (!pending || force) {
    pending = supabase
      .from("site_settings")
      .select("installments_fee_percent,installments_max")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return null;
        const fee = data.installments_fee_percent;
        if (fee === null || fee === undefined || !(Number(fee) >= 0)) return null;
        const max = Math.min(12, Math.max(2, Number(data.installments_max) || 12));
        return { feePercent: Number(fee), max };
      })
      .catch(() => null);
  }
  return pending;
}

export function useInstallmentSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    let alive = true;
    loadInstallmentSettings().then((value) => alive && setSettings(value));
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}

// Valor da parcela com o juro. Só anuncia se o número máximo de parcelas cabe (parcela mínima de R$ 5,00).
export function planInstallments(priceCents, settings) {
  if (!settings || !(priceCents >= MIN_PRICE_CENTS)) return null;
  const totalCents = Math.round(priceCents * (1 + settings.feePercent / 100));
  if (totalCents / settings.max < MIN_INSTALLMENT_CENTS) return null;
  return {
    count: settings.max,
    perCents: Math.round(totalCents / settings.max),
    totalCents,
    cashCents: priceCents,
    withInterest: settings.feePercent > 0,
  };
}

// Juro total a partir de um teste: preço do produto e o total que a InfinitePay mostrou no parcelamento.
export function feeFromTest(priceReais, totalReais) {
  const price = Number(String(priceReais).replace(",", "."));
  const total = Number(String(totalReais).replace(",", "."));
  if (!(price > 0) || !(total >= price)) return null;
  return Math.round((total / price - 1) * 10000) / 100;
}
