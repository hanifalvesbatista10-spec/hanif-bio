// Onde o botão "Comprar" de cada produto leva:
// - checkout próprio (product.checkout_mode = "internal"): a página /checkout/<slug> do próprio site;
// - venda por WhatsApp (product.checkout_mode = "whatsapp"): sem preço fixo, abre o WhatsApp direto;
// - senão, o link de venda cadastrado (checkout_url) ou, na falta dele, o WhatsApp.
export function usesInternalCheckout(product) {
  return product?.checkout_mode === "internal" && Boolean(product?.slug);
}

export function isWhatsappCheckout(product) {
  return product?.checkout_mode === "whatsapp";
}

// fallbackWhatsapp: número padrão do site (site_settings.whatsapp_url), usado quando o produto
// está no modo WhatsApp mas não tem um link próprio cadastrado.
export function getProductCheckout(product, fallbackWhatsapp) {
  if (usesInternalCheckout(product)) return `/checkout/${product.slug}`;
  if (isWhatsappCheckout(product)) return product?.whatsapp_url || fallbackWhatsapp || "";
  return product?.checkout_url || product?.whatsapp_url || "";
}

// Texto do botão de compra, consistente em todo o site.
export function checkoutCtaLabel(product) {
  if (usesInternalCheckout(product)) return "Comprar agora";
  if (isWhatsappCheckout(product)) return "Falar no WhatsApp";
  return "Quero acessar agora";
}

// Link do próprio site abre na mesma aba; link externo, em outra aba.
export function checkoutLinkProps(href) {
  return typeof href === "string" && href.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" };
}
