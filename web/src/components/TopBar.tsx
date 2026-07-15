import { Link } from "react-router-dom";
import { useTheme } from "../theme.js";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-800/10 bg-parchment-50/90 px-4 py-3 backdrop-blur dark:border-parchment-50/10 dark:bg-ink-950/90">
      <Link to="/" className="flex items-baseline gap-2">
        <span className="font-display text-lg font-semibold tracking-tight">Verbo & Canção</span>
        <span className="hidden text-xs text-ink-700/60 dark:text-parchment-100/50 sm:inline">
          apreciação e validação de letras
        </span>
      </Link>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Alternar tema claro/escuro"
        className="rounded-full border border-ink-800/15 px-3 py-1 text-sm dark:border-parchment-50/15"
      >
        {theme === "dark" ? "☾" : "☀"}
      </button>
    </header>
  );
}
