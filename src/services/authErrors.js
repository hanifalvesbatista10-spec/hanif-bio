// Mensagens de login/cadastro em português e regras de senha. O Supabase devolve os erros em inglês.

export function friendlyAuthError(error) {
  const raw = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || 0);

  if (raw.includes("invalid login credentials") || code === "invalid_credentials") return "E-mail ou senha incorretos.";
  if (raw.includes("email not confirmed") || code === "email_not_confirmed") {
    return "Você ainda não confirmou o seu e-mail. Abra a mensagem de confirmação que enviamos (veja também a caixa de spam) ou peça um novo e-mail abaixo.";
  }
  // sem servidor de e-mail próprio, o Supabase só entrega para a equipe do projeto
  if (raw.includes("email address not authorized") || raw.includes("error sending") || raw.includes("sending confirmation email") || raw.includes("sending recovery email")) {
    return "Não conseguimos enviar o e-mail agora. Avise o suporte: o envio de e-mails do site ainda não está configurado.";
  }
  if (code === "over_email_send_rate_limit" || raw.includes("email rate limit") || raw.includes("security purposes")) {
    return "Enviamos e-mails demais em pouco tempo. Aguarde alguns minutos e tente de novo.";
  }
  if (status === 429 || raw.includes("too many") || raw.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (raw.includes("user already registered") || code === "user_already_exists" || code === "email_exists") {
    return "Já existe uma conta com este e-mail. Entre com a sua senha ou use “Esqueci minha senha”.";
  }
  if (code === "same_password" || raw.includes("different from the old password") || raw.includes("same password")) {
    return "A nova senha precisa ser diferente da senha atual.";
  }
  if (code === "weak_password" || raw.includes("weak password") || raw.includes("known to be weak") || raw.includes("pwned")) {
    return "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra, com letras e números.";
  }
  if (raw.includes("password should be at least")) return "A senha é curta demais. Use pelo menos 8 caracteres.";
  if (raw.includes("unable to validate email") || raw.includes("invalid email") || code === "validation_failed") return "Confira o e-mail digitado.";
  if (raw.includes("signup is disabled") || raw.includes("signups not allowed")) return "Novos cadastros estão desativados no momento.";
  if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("network request failed")) {
    return "Sem conexão com o servidor. Confira a sua internet e tente de novo.";
  }
  if (raw.includes("jwt") || raw.includes("session") || raw.includes("expired") || code === "otp_expired") {
    return "O link ou a sessão expirou. Peça um novo link de recuperação.";
  }
  return "Não foi possível concluir agora. Tente de novo em instantes.";
}

// Problemas com a senha nova (vazio = ok).
export function passwordProblem(password, { email = "" } = {}) {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  if (/^(.)\1+$/.test(password)) return "Escolha uma senha menos previsível.";
  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) return "A senha não deve conter o seu e-mail.";
  if (["12345678", "123456789", "1234567890", "senha123", "senha1234", "password1", "abcd1234", "qwerty123"].includes(password.toLowerCase())) {
    return "Essa senha é muito comum. Escolha outra.";
  }
  return "";
}

// 0 = fraca, 1 = média, 2 = forte
export function passwordStrength(password) {
  if (!password) return { level: -1, label: "" };
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^a-zA-Z0-9]/.test(password)) points += 1;
  if (passwordProblem(password)) return { level: 0, label: "Fraca" };
  if (points >= 4) return { level: 2, label: "Forte" };
  return { level: 1, label: "Média" };
}

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
