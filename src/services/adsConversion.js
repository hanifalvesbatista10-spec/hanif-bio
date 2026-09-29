// Conversão de compra do Google Ads. Dispara só com o pedido PAGO e uma única vez por pedido:
// o servidor marca o pedido (ads_conversion_sent_at) e só então o evento é enviado.
const SEND_TO = "AW-18404535998/U6W8CJq0geYcEL7d-8dE";
const inFlight = new Set();

export async function reportPurchaseConversion(orderId) {
  if (!orderId || inFlight.has(orderId) || typeof window.gtag !== "function") return;
  inFlight.add(orderId);
  try {
    const response = await fetch("/api/checkout-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.send) return;
    window.gtag("event", "conversion", {
      send_to: SEND_TO,
      value: Number(data.value),
      currency: "BRL",
      transaction_id: data.transactionId,
    });
  } catch {
    // sem rede agora: o pedido não foi marcado, então tenta de novo no próximo acesso à área do aluno
  } finally {
    inFlight.delete(orderId);
  }
}
