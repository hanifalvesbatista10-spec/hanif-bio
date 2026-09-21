// Cliente das funções /api/checkout-* (o pagamento em si é confirmado no servidor, pelo webhook do Asaas).
import { supabase } from "./supabase";

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || "Não foi possível concluir. Tente novamente em instantes.");
    error.code = data?.error;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function createCheckout(payload) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const response = await fetch("/api/checkout-create", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  return parse(response);
}

export async function fetchOrderStatus(orderId) {
  const response = await fetch(`/api/checkout-status?order=${encodeURIComponent(orderId)}`, { cache: "no-store" });
  return parse(response);
}

export function formatMoneyCents(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
