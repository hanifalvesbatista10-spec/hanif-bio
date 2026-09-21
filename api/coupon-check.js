// POST /api/coupon-check   { slug, code, email?, cpf? }
// Diz ao comprador quanto o cupom desconta ANTES de pagar. É só uma prévia: o desconto de verdade é
// recalculado no servidor em /api/checkout-create, então mexer aqui no navegador não muda o preço cobrado.
import { HttpError, readBody } from "./_lib/mux.js";
import { checkoutHandler, priceInCents, requireCheckoutConfig, sb } from "./_lib/checkout.js";
import { resolveCoupon } from "./_lib/coupons.js";

export default checkoutHandler(["POST"], async (req, res) => {
  requireCheckoutConfig(["serviceKey"]);
  const body = readBody(req);
  const slug = String(body.slug || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const cpf = String(body.cpf || "").replace(/\D/g, "");
  if (!slug) throw new HttpError(400, "invalid_product", "Produto não informado.");

  const products = await sb(`products?slug=eq.${encodeURIComponent(slug)}&select=id,price,promotional_price,status,checkout_mode&limit=1`);
  const product = products?.[0];
  if (!product || product.status !== "active" || product.checkout_mode !== "internal") {
    throw new HttpError(404, "product_not_found", "Produto não encontrado.");
  }
  const listCents = priceInCents(product);
  const { coupon, discountCents, finalCents } = await resolveCoupon({ code: body.code, product, listCents, email, cpf });

  res.status(200).setHeader("Cache-Control", "no-store").json({
    valid: true,
    code: coupon.code.toUpperCase(),
    label: coupon.discount_type === "percent" ? `${coupon.discount_value}% de desconto` : "Desconto",
    listCents,
    discountCents,
    finalCents,
    free: finalCents === 0,
  });
});
