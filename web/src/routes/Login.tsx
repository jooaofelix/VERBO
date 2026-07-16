import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authErrorCode, friendlyAuthErrorMessage } from "../lib/authErrors.js";
import {
  signInAsDemoUser,
  signInWithEmail,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
} from "../services/firebase/auth.js";

const inputClass =
  "rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60";

interface GoogleFailure {
  code: string;
  message: string;
}

export function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"" | "email" | "google" | "demo" | "redirect">("");
  const [googleFailure, setGoogleFailure] = useState<GoogleFailure | null>(null);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    try {
      await signInWithEmail(email, password);
      navigate("/inicio", { replace: true });
    } catch (err) {
      setError(friendlyAuthErrorMessage(err));
    } finally {
      setLoading("");
    }
  }

  // Deliberately not `async` and calling signInWithGooglePopup as the very
  // first statement: some browsers only allow a popup to open inside the
  // same event-loop turn as the click that triggered it, so nothing may be
  // `await`ed before this call.
  function handleGoogleLogin() {
    setError(null);
    setGoogleFailure(null);
    setLoading("google");
    signInWithGooglePopup()
      .then(() => {
        navigate("/inicio", { replace: true });
      })
      .catch((err: unknown) => {
        setGoogleFailure({ code: authErrorCode(err), message: friendlyAuthErrorMessage(err) });
      })
      .finally(() => setLoading(""));
  }

  // A manual, explicit fallback only — never triggered automatically when
  // the popup closes, which would risk a redirect loop.
  function handleGoogleRedirect() {
    setGoogleFailure(null);
    setLoading("redirect");
    signInWithGoogleRedirect().catch((err: unknown) => {
      setLoading("");
      setGoogleFailure({ code: authErrorCode(err), message: friendlyAuthErrorMessage(err) });
    });
    // On success the browser navigates away to Google; there is nothing
    // further to do here — completeGoogleRedirectSignIn() picks it up on
    // the way back, in AuthProvider.
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading("demo");
    try {
      await signInAsDemoUser();
      navigate("/inicio", { replace: true });
    } catch (err) {
      setError(friendlyAuthErrorMessage(err));
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-12">
      <div>
        <h1 className="font-display text-2xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
          Suas composições ficam vinculadas à sua conta e nunca são vistas por outros usuários.
        </p>
      </div>

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">E-mail</span>
          <input
            type="email"
            required
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Senha</span>
          <input
            type="password"
            required
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading !== ""}
          className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {loading === "email" ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <Link to="/recuperar-senha" className="text-sm text-verse-600 underline dark:text-verse-400">
        Esqueci minha senha
      </Link>

      <div className="flex items-center gap-2 text-xs text-ink-700/50 dark:text-parchment-100/40">
        <div className="h-px flex-1 bg-ink-800/10 dark:bg-parchment-50/10" />
        ou
        <div className="h-px flex-1 bg-ink-800/10 dark:bg-parchment-50/10" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading !== ""}
        className="rounded-xl border border-ink-800/15 px-5 py-2.5 font-medium disabled:opacity-50 dark:border-parchment-50/15"
      >
        {loading === "google" ? "Conectando..." : "Entrar com Google"}
      </button>

      {googleFailure && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
        >
          <p>{googleFailure.message}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={handleGoogleRedirect}
              disabled={loading === "redirect"}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {loading === "redirect" ? "Abrindo..." : "Entrar em tela inteira"}
            </button>
          </div>
          <details className="text-xs opacity-70">
            <summary className="cursor-pointer">Ver detalhes</summary>
            <p className="mt-1 font-mono">{googleFailure.code}</p>
          </details>
        </div>
      )}

      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={loading !== ""}
        className="rounded-xl border border-dashed border-ink-800/20 px-5 py-2.5 text-sm text-ink-700/70 disabled:opacity-50 dark:border-parchment-50/20 dark:text-parchment-100/60"
      >
        {loading === "demo" ? "Entrando..." : "Continuar sem conta (modo demonstração)"}
      </button>
      <p className="text-xs text-ink-700/50 dark:text-parchment-100/40">
        No modo demonstração seus dados ficam isolados nesta sessão anônima — eles não aparecem
        para outros usuários, mas também não podem ser recuperados se você limpar os dados do
        navegador ou trocar de dispositivo.
      </p>

      <p className="text-sm">
        Não tem conta?{" "}
        <Link to="/cadastro" className="text-verse-600 underline dark:text-verse-400">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
