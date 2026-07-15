import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { friendlyAuthErrorMessage } from "../lib/authErrors.js";
import { signUpWithEmail } from "../services/firebase/auth.js";

const inputClass =
  "rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60";

export function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail(email, password, name || undefined);
      navigate("/", { replace: true });
    } catch (err) {
      setError(friendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-12">
      <div>
        <h1 className="font-display text-2xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
          Suas composições ficam privadas, vinculadas apenas à sua conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nome (opcional)</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
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
            minLength={6}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="text-sm">
        Já tem conta?{" "}
        <Link to="/entrar" className="text-verse-600 underline dark:text-verse-400">
          Entrar
        </Link>
      </p>
    </div>
  );
}
