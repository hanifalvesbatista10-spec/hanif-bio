// Envio de e-mail transacional pela Resend (recuperação de vendas). Não é o mesmo canal do Supabase Auth
// (que só manda confirmação de cadastro e recuperação de senha, configurado como SMTP): aqui a chamada é
// direta à API da Resend, com conteúdo próprio.
export function resendConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.RESEND_FROM || "",
  };
}

export async function sendEmail({ to, subject, html }) {
  const { apiKey, from } = resendConfig();
  if (!apiKey || !from) {
    throw new Error("Resend não configurado (faltam RESEND_API_KEY e/ou RESEND_FROM na Vercel).");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || `Resend ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
