import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** A centered, full-width loading message — used while a Firestore doc/list is still resolving. */
export function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center px-4 py-10 text-center text-sm text-ink-700/60 dark:text-parchment-100/50">
      {message}
    </div>
  );
}

/** A friendly panel for a Firestore read error — never a blank screen. */
export function ErrorState({
  message = "Não foi possível carregar esta tela agora.",
  onRetry,
  children,
}: {
  message?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="text-3xl">⚠️</p>
      <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white hover:bg-verse-500"
        >
          Tentar novamente
        </button>
      )}
      {children}
    </div>
  );
}

/** A generic "nothing here yet" panel with an optional call to action. */
export function EmptyState({
  title,
  message,
  actionLabel,
  actionTo,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-3xl">📖</p>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {message && <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">{message}</p>}
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white hover:bg-verse-500"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/** "This document doesn't exist or was removed" — with the two required recovery actions. */
export function NotFoundState({
  message,
  primaryLabel,
  primaryTo,
}: {
  message: string;
  primaryLabel: string;
  primaryTo: string;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="text-3xl">🔍</p>
      <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          to="/projetos"
          className="rounded-xl border border-ink-800/15 px-4 py-2 text-sm font-medium dark:border-parchment-50/15"
        >
          Voltar aos projetos
        </Link>
        <Link
          to={primaryTo}
          className="rounded-xl bg-verse-600 px-4 py-2 text-sm font-medium text-white hover:bg-verse-500"
        >
          {primaryLabel}
        </Link>
      </div>
    </div>
  );
}
