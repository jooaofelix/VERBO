import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { friendlyAuthErrorMessage } from "../lib/authErrors.js";
import { signInAsDemoUser, signInWithEmail, signInWithGoogle } from "../services/firebase/auth.js";

const inputClass =
  "rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"" | "email" | "google" | "demo">("");

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    try {
      await signInWithEmail(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyAuthErrorMessage(err));
    } finally {
      setLoading("");
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading("google");
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyAuthErrorMessage(err));
    } finally {
      setLoading("");
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading("demo");
    try {
      await signInAsDemoUser();
      navigate(from, { replace: true });
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
