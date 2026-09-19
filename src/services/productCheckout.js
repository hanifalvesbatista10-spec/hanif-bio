// Todos os produtos, incluindo a Mentoria de APH, usam o checkout_url
// cadastrado no Supabase (painel > Produtos).
export function getProductCheckout(product) {
  return product?.checkout_url || product?.whatsapp_url || "";
}
