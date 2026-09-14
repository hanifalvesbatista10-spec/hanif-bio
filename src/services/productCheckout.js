// Checkout da Mentoria de APH fornecido pelo responsável pelo produto.
// Os demais produtos continuam usando o checkout cadastrado no Supabase.
export function getProductCheckout(product) {
  if (product?.slug === "mentoria-aph") return "https://pay.kiwify.com.br/ZvtGR1D";
  return product?.checkout_url || "";
}

// Entrada pública autorizada para apresentar a página da mentoria na bio.
export const mentorshipProduct = {
  id: "mentoria-aph", slug: "mentoria-aph", title: "Mentoria de APH",
  short_description: "Mentoria teórica de APH: emergências traumáticas, clínicas e psiquiátricas, afogamento e assuntos de urgência e emergência.",
  cover_url: "/assets/mentoria-capa.png", category: "Mentoria", price: null, promotional_price: null
};
export function withMentorship(products = []) {
  return products.some(product => product.slug === mentorshipProduct.slug)
    ? products : [mentorshipProduct, ...products];
}
