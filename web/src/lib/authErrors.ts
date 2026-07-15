const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
  "auth/wrong-password": "Senha incorreta.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/popup-closed-by-user": "A janela de login foi fechada antes de concluir.",
  "auth/network-request-failed": "Falha de rede. Verifique sua conexão e tente novamente.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um momento antes de tentar de novo.",
};

export function friendlyAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return "Não foi possível concluir a operação. Tente novamente.";
}
