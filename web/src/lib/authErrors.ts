const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
  "auth/wrong-password": "Senha incorreta.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/popup-blocked":
    "O navegador bloqueou a janela de login. Autorize popups para este site ou use a opção " +
    "Entrar em tela inteira.",
  "auth/popup-closed-by-user": "A janela de login foi fechada antes da conclusão.",
  "auth/cancelled-popup-request":
    "Uma nova tentativa de login foi iniciada antes da anterior terminar. Tente novamente.",
  "auth/unauthorized-domain": "Este endereço ainda não está autorizado no Firebase Authentication.",
  "auth/operation-not-allowed": "O login com Google ainda não está habilitado no Firebase.",
  "auth/network-request-failed": "Falha de rede. Verifique sua conexão e tente novamente.",
  "auth/internal-error": "Ocorreu um erro interno ao tentar entrar. Tente novamente em alguns instantes.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um momento antes de tentar de novo.",
};

/** Firebase's own `error.code`, e.g. "auth/popup-blocked" — shown collapsed under "Ver detalhes". */
export function authErrorCode(error: unknown): string {
  return (error as { code?: string })?.code ?? "erro-desconhecido";
}

export function friendlyAuthErrorMessage(error: unknown): string {
  const code = authErrorCode(error);
  return MESSAGES[code] ?? "Não foi possível concluir a operação. Tente novamente.";
}
