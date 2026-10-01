import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import RowActions from "../../components/admin/RowActions";
import { formatMoneyCents } from "../../services/checkoutApi";

const emptyForm = {
  code: "",
  description: "",
  discount_type: "percent",
  value: "",
  product_id: "",
  starts_on: "",
  expires_on: "",
  max_uses: "",
  one_per_customer: true,
  pay_online: true,
  pay_boleto: true,
};

const CODE_RE = /^[A-Z0-9_-]{2,40}$/;

function isMissingTable(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("pgrst205") || text.includes("does not exist") || text.includes("schema cache");
}

// Código legível e difícil de adivinhar (sem letras que se confundem: O/0, I/1)
function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `HA${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

const dateBr = (value) => (value ? new Date(value).toLocaleDateString("pt-BR") : null);

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [uses, setUses] = useState({}); // { coupon_id: { paid, discount } }
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [editingCoupon, setEditingCoupon] = useState(null); // id do cupom com o desconto em edição
  const [discountForm, setDiscountForm] = useState({ discount_type: "percent", value: "" });
  const [discountSaving, setDiscountSaving] = useState(false);

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  const load = async () => {
    setLoading(true);
    const [couponsResult, productsResult, ordersResult] = await Promise.all([
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id,title,slug,checkout_mode").order("title", { ascending: true }),
      supabase.from("orders").select("coupon_id,status,discount_cents").not("coupon_id", "is", null).limit(5000),
    ]);
    if (couponsResult.error) {
      if (isMissingTable(couponsResult.error)) setMissing(true);
      else notify("error", `Não foi possível carregar os cupons: ${couponsResult.error.message}`);
      setCoupons([]);
    } else {
      setMissing(false);
      setCoupons(couponsResult.data || []);
    }
    setProducts(productsResult.data || []);
    const summary = {};
    (ordersResult.data || []).forEach((order) => {
      if (order.status !== "paid") return;
      const item = summary[order.coupon_id] || { paid: 0, discount: 0 };
      item.paid += 1;
      item.discount += order.discount_cents || 0;
      summary[order.coupon_id] = item;
    });
    setUses(summary);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const productById = useMemo(() => Object.fromEntries(products.map((item) => [item.id, item])), [products]);
  const checkoutProducts = products.filter((item) => item.checkout_mode === "internal");

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  const create = async (event) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!CODE_RE.test(code)) return notify("error", "O código deve ter de 2 a 40 letras, números, “-” ou “_” (sem espaços nem acentos).");

    const raw = Number(String(form.value).replace(",", "."));
    let discount_value;
    if (form.discount_type === "percent") {
      if (!Number.isFinite(raw) || raw < 1 || raw > 100 || !Number.isInteger(raw)) return notify("error", "A porcentagem deve ser um número inteiro de 1 a 100.");
      discount_value = raw;
    } else {
      if (!Number.isFinite(raw) || raw <= 0) return notify("error", "Informe o valor do desconto em reais (ex.: 50 ou 49,90).");
      discount_value = Math.round(raw * 100);
    }

    const maxUses = form.max_uses === "" ? null : Number(form.max_uses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return notify("error", "O limite de usos deve ser um número inteiro maior que zero (ou deixe em branco para ilimitado).");
    if (form.starts_on && form.expires_on && form.expires_on < form.starts_on) return notify("error", "A data final não pode ser antes da inicial.");

    if (!form.pay_online && !form.pay_boleto) return notify("error", "Marque pelo menos uma forma de pagamento em que o cupom vale.");
    // as duas marcadas = vale para tudo (não grava nada); o campo só vai ao banco quando há restrição
    const restricted = form.pay_online && form.pay_boleto ? null : [form.pay_online ? "online" : "boleto"];

    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      code,
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value,
      product_id: form.product_id || null,
      starts_at: form.starts_on ? `${form.starts_on}T00:00:00-03:00` : null,
      expires_at: form.expires_on ? `${form.expires_on}T23:59:59-03:00` : null,
      max_uses: maxUses,
      one_per_customer: form.one_per_customer,
      ...(restricted ? { payment_methods: restricted } : {}),
      active: true,
    });
    setSaving(false);
    if (error) {
      if (isMissingTable(error)) setMissing(true);
      else if (String(error.message).includes("payment_methods")) notify("error", "O banco ainda não tem a regra por forma de pagamento. Execute supabase/27_cupom_por_forma_de_pagamento.sql no SQL Editor e tente de novo.");
      else if (error.code === "23505") notify("error", `Já existe um cupom com o código ${code}.`);
      else notify("error", `Não foi possível criar o cupom: ${error.message}`);
      return;
    }
    notify("success", `Cupom ${code} criado.`);
    setForm(emptyForm);
    load();
  };

  const startEditDiscount = (coupon) => {
    setEditingCoupon(coupon.id);
    setDiscountForm({
      discount_type: coupon.discount_type,
      value: coupon.discount_type === "percent" ? String(coupon.discount_value) : String(coupon.discount_value / 100).replace(".", ","),
    });
  };

  const saveDiscount = async (coupon) => {
    const raw = Number(String(discountForm.value).replace(",", "."));
    let discount_value;
    if (discountForm.discount_type === "percent") {
      if (!Number.isFinite(raw) || raw < 1 || raw > 100 || !Number.isInteger(raw)) return notify("error", "A porcentagem deve ser um número inteiro de 1 a 100.");
      discount_value = raw;
    } else {
      if (!Number.isFinite(raw) || raw <= 0) return notify("error", "Informe o valor do desconto em reais (ex.: 50 ou 49,90).");
      discount_value = Math.round(raw * 100);
    }
    setDiscountSaving(true);
    const { error } = await supabase.from("coupons").update({ discount_type: discountForm.discount_type, discount_value }).eq("id", coupon.id);
    setDiscountSaving(false);
    if (error) return notify("error", error.message);
    notify("success", `Desconto do cupom ${coupon.code} atualizado para ${discountForm.discount_type === "percent" ? `${discount_value}%` : formatMoneyCents(discount_value)}.`);
    setEditingCoupon(null);
    load();
  };

  const toggle = async (coupon) => {
    const { error } = await supabase.from("coupons").update({ active: !coupon.active }).eq("id", coupon.id);
    if (error) return notify("error", error.message);
    load();
  };

  const remove = async (coupon) => {
    if (!window.confirm(`Excluir o cupom ${coupon.code}? Os pedidos que já usaram continuam registrados.`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", coupon.id);
    if (error) return notify("error", error.message);
    load();
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("success", `${label} copiado.`);
    } catch {
      notify("error", "Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const payLabel = (coupon) => {
    const list = Array.isArray(coupon.payment_methods) ? coupon.payment_methods : [];
    if (list.length !== 1) return "";
    return list[0] === "boleto" ? "Só no boleto" : "Só no Pix ou cartão";
  };

  const describe = (coupon) =>
    coupon.discount_type === "percent" ? `${coupon.discount_value}%` : formatMoneyCents(coupon.discount_value);

  const statusOf = (coupon) => {
    const now = Date.now();
    const used = uses[coupon.id]?.paid || 0;
    if (!coupon.active) return { label: "Desativado", tone: "draft" };
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) return { label: "Expirado", tone: "draft" };
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return { label: "Ainda não começou", tone: "draft" };
    if (coupon.max_uses && used >= coupon.max_uses) return { label: "Esgotado", tone: "draft" };
    return { label: "Ativo", tone: "published" };
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">
          O banco ainda não tem os cupons. Execute <strong>supabase/20_cupons.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span>VENDAS</span>
          <h2>Cupons de desconto</h2>
        </div>
      </div>

      <p className="adm-hint">
        Crie códigos de desconto para o checkout do site. O comprador digita o código (ou abre o link com o cupom) e o desconto é aplicado
        no servidor. Um cupom de <strong>100%</strong> libera o acesso grátis, sem cobrança. Vale só para produtos com “Checkout do próprio site”.
      </p>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

      <form className="cp-form" onSubmit={create}>
        <h3>Novo cupom</h3>
        <div className="cp-grid">
          <label>Código
            <div className="cp-inline">
              <input value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))} placeholder="Ex.: TURMA10" maxLength={40} required />
              <button type="button" className="adm-action" onClick={() => setForm((current) => ({ ...current, code: randomCode() }))}>Gerar</button>
            </div>
          </label>
          <label>Tipo de desconto
            <select value={form.discount_type} onChange={set("discount_type")}>
              <option value="percent">Porcentagem (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </label>
          <label>{form.discount_type === "percent" ? "Porcentagem (1 a 100)" : "Valor do desconto (R$)"}
            <input value={form.value} onChange={set("value")} inputMode="decimal" placeholder={form.discount_type === "percent" ? "20" : "50,00"} required />
          </label>
          <label>Vale para
            <select value={form.product_id} onChange={set("product_id")}>
              <option value="">Todos os produtos com checkout do site</option>
              {checkoutProducts.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label>Começa em (opcional)
            <input type="date" value={form.starts_on} onChange={set("starts_on")} />
          </label>
          <label>Vale até (opcional)
            <input type="date" value={form.expires_on} onChange={set("expires_on")} />
          </label>
          <label>Limite de usos (opcional)
            <input value={form.max_uses} onChange={set("max_uses")} inputMode="numeric" placeholder="Em branco = ilimitado" />
          </label>
          <label>Anotação (só você vê)
            <input value={form.description} onChange={set("description")} placeholder="Ex.: Turma de outubro" maxLength={120} />
          </label>
        </div>
        <fieldset className="cp-pay">
          <legend>Formas de pagamento em que o cupom vale</legend>
          <label className="cp-check"><input type="checkbox" checked={form.pay_online} onChange={set("pay_online")} /> Pix ou cartão</label>
          <label className="cp-check"><input type="checkbox" checked={form.pay_boleto} onChange={set("pay_boleto")} /> Boleto</label>
          <small>Pix e cartão são escolhidos pelo comprador na página da InfinitePay, por isso andam juntos. Deixe as duas marcadas para o cupom valer sempre.</small>
        </fieldset>
        <label className="cp-check"><input type="checkbox" checked={form.one_per_customer} onChange={set("one_per_customer")} /> Cada pessoa (e-mail ou CPF) pode usar este cupom uma vez só</label>
        <button className="admin-button primary" type="submit" disabled={saving}>{saving ? "Criando..." : "Criar cupom"}</button>
      </form>

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : coupons.length === 0 ? (
        <div className="admin-empty">Nenhum cupom ainda. Crie o primeiro acima.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Cupom</th><th>Desconto</th><th>Vale para</th><th>Validade</th><th>Usos</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const product = coupon.product_id ? productById[coupon.product_id] : null;
                const status = statusOf(coupon);
                const used = uses[coupon.id];
                return (
                  <tr key={coupon.id}>
                    <td><strong>{coupon.code}</strong>{coupon.description && <small>{coupon.description}</small>}</td>
                    <td>
                      {editingCoupon === coupon.id ? (
                        <div className="cp-inline">
                          <select
                            value={discountForm.discount_type}
                            onChange={(e) => setDiscountForm((current) => ({ ...current, discount_type: e.target.value }))}
                            disabled={discountSaving}
                          >
                            <option value="percent">%</option>
                            <option value="fixed">R$</option>
                          </select>
                          <input
                            value={discountForm.value}
                            onChange={(e) => setDiscountForm((current) => ({ ...current, value: e.target.value }))}
                            inputMode="decimal"
                            style={{ width: 70 }}
                            disabled={discountSaving}
                            aria-label={`Desconto do cupom ${coupon.code}`}
                          />
                          <button type="button" className="admin-button primary" disabled={discountSaving} onClick={() => saveDiscount(coupon)}>
                            {discountSaving ? "..." : "Salvar"}
                          </button>
                          <button type="button" className="admin-button adm-ghost" disabled={discountSaving} onClick={() => setEditingCoupon(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>{describe(coupon)}{coupon.discount_type === "percent" && coupon.discount_value === 100 ? " (grátis)" : ""}</>
                      )}
                    </td>
                    <td>{product ? product.title : "Todos"}{payLabel(coupon) && <small>{payLabel(coupon)}</small>}</td>
                    <td>
                      {coupon.starts_at || coupon.expires_at
                        ? `${dateBr(coupon.starts_at) || "—"} a ${dateBr(coupon.expires_at) || "sem fim"}`
                        : "Sem prazo"}
                    </td>
                    <td>
                      {used?.paid || 0}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                      {used?.discount ? <small>{formatMoneyCents(used.discount)} em descontos</small> : null}
                    </td>
                    <td><span className={`status-badge ${status.tone}`}>{status.label}</span></td>
                    <td>
                      <RowActions
                        label={`Ações do cupom ${coupon.code}`}
                        primary={{ label: "Copiar código", onClick: () => copy(coupon.code, "Código") }}
                        items={[
                          { label: "Editar desconto", onClick: () => startEditDiscount(coupon) },
                          { label: "Copiar link com o cupom", hidden: !product, onClick: () => copy(`${window.location.origin}/checkout/${product.slug}?cupom=${coupon.code}`, "Link com o cupom") },
                          { label: coupon.active ? "Desativar cupom" : "Ativar cupom", onClick: () => toggle(coupon) },
                          { label: "Excluir cupom", danger: true, onClick: () => remove(coupon) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
