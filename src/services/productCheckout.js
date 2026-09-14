// Checkout da Mentoria de APH fornecido pelo responsável pelo produto.
// Os demais produtos continuam usando o checkout cadastrado no Supabase.
export function getProductCheckout(product) {
  if (product?.slug === "mentoria-aph") return "https://pay.kiwify.com.br/ZvtGR1D";
  return product?.checkout_url || "";
}
