import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { signOutUser } from "../services/firebase/auth.js";
import { useTheme } from "../theme.js";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOutUser();
    navigate("/entrar", { replace: true });
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-800/10 bg-parchment-50/90 px-4 py-3 backdrop-blur dark:border-parchment-50/10 dark:bg-ink-950/90">
      <Link to="/" className="flex items-baseline gap-2">
        <span className="font-display text-lg font-semibold tracking-tight">Verbo & Canção</span>
        <span className="hidden text-xs text-ink-700/60 dark:text-parchment-100/50 sm:inline">
          apreciação e validação de letras
        </span>
      </Link>
      <div className="flex items-center gap-2">
        {user && (
          <span className="hidden text-xs text-ink-700/60 dark:text-parchment-100/50 sm:inline">
            {user.isAnonymous ? "Modo demonstração" : user.email}
          </span>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar tema claro/escuro"
          className="rounded-full border border-ink-800/15 px-3 py-1 text-sm dark:border-parchment-50/15"
        >
          {theme === "dark" ? "☾" : "☀"}
        </button>
        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-ink-800/15 px-3 py-1 text-xs dark:border-parchment-50/15"
          >
            Sair
          </button>
        )}
      </div>
    </header>
  );
}
