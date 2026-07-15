import { useState } from "react";
import { Link } from "react-router-dom";
import { friendlyAuthErrorMessage } from "../lib/authErrors.js";
import { sendPasswordReset } from "../services/firebase/auth.js";

const inputClass =
  "rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(friendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-12">
      <div>
        <h1 className="font-display text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-sm text-ink-700/70 dark:text-parchment-100/60">
          Enviaremos um link de redefinição para o seu e-mail.
        </p>
      </div>

      {sent ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          Se existir uma conta com este e-mail, um link de redefinição foi enviado.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar link de redefinição"}
          </button>
        </form>
      )}

      <Link to="/entrar" className="text-sm text-verse-600 underline dark:text-verse-400">
        Voltar para o login
      </Link>
    </div>
  );
}
