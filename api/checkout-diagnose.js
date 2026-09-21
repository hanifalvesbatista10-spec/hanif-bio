// GET /api/checkout-diagnose  (somente administrador)
// Testa a configuração do checkout: quais variáveis existem e, para o boleto, se o Asaas aceita a chave
// (e em que ambiente). Só faz uma leitura inofensiva. Nunca devolve as chaves.
import { requireAdmin } from "./_lib/mux.js";
import { checkoutConfig, checkoutHandler, sendJsonNoStore } from "./_lib/checkout.js";

const URLS = { production: "https://api.asaas.com/v3", sandbox: "https://api-sandbox.asaas.com/v3" };

async function probe(env, key) {
  try {
    const response = await fetch(`${URLS[env]}/customers?limit=1`, {
      headers: { access_token: key, "User-Agent": "hanif-bio-checkout", "Content-Type": "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    const message = Array.isArray(data?.errors) ? data.errors.map((item) => item.description).join("; ") : "";
    return { env, ok: response.ok, status: response.status, message: response.ok ? "" : message || `HTTP ${response.status}` };
  } catch (error) {
    return { env, ok: false, status: 0, message: `Sem resposta do Asaas (${error.message})` };
  }
}

export default checkoutHandler(["GET"], async (req, res) => {
  await requireAdmin(req);
  const config = checkoutConfig();

  const result = {
    variables: {
      INFINITEPAY_HANDLE: Boolean(config.infinitepayHandle),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(config.serviceKey),
      SITE_URL: Boolean(process.env.SITE_URL),
      // só o boleto usa o Asaas
      ASAAS_API_KEY: Boolean(config.asaasKey),
      ASAAS_WEBHOOK_TOKEN: Boolean(config.webhookToken),
    },
    infinitepayHandle: config.infinitepayHandle || null,
    envUsed: config.asaasEnv,
    envForced: Boolean(process.env.ASAAS_ENV),
    asaas: null,
    otherEnv: null,
  };

  if (config.asaasKey) {
    result.asaas = await probe(config.asaasEnv, config.asaasKey);
    // chave recusada: talvez seja do outro ambiente (sandbox x produção)
    if (!result.asaas.ok && result.asaas.status === 401) {
      result.otherEnv = await probe(config.asaasEnv === "sandbox" ? "production" : "sandbox", config.asaasKey);
    }
  }

  sendJsonNoStore(res, 200, result);
});
