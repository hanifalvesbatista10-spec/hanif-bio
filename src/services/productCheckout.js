// Onde o botão "Comprar" de cada produto leva:
// - checkout próprio (product.checkout_mode = "internal"): a página /checkout/<slug> do próprio site;
// - senão, o link de venda cadastrado (checkout_url) ou o WhatsApp.
export function usesInternalCheckout(product) {
  return product?.checkout_mode === "internal" && Boolean(product?.slug);
}

export function getProductCheckout(product) {
  if (usesInternalCheckout(product)) return `/checkout/${product.slug}`;
  return product?.checkout_url || product?.whatsapp_url || "";
}

// Link do próprio site abre na mesma aba; link externo, em outra aba.
export function checkoutLinkProps(href) {
  return typeof href === "string" && href.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" };
}
