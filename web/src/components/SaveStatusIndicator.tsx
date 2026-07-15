import type { SaveStatus } from "../hooks/useDebouncedAutosave.js";

const LABEL: Record<SaveStatus, string> = {
  salvo: "Salvo",
  salvando: "Salvando...",
  offline: "Offline — alterações salvas localmente",
  sincronizando: "Sincronizando...",
  erro: "Erro ao salvar",
};

const CLASS: Record<SaveStatus, string> = {
  salvo: "text-emerald-700 dark:text-emerald-400",
  salvando: "text-ink-700/60 dark:text-parchment-100/50",
  offline: "text-amber-700 dark:text-amber-400",
  sincronizando: "text-sky-700 dark:text-sky-400",
  erro: "text-red-600 dark:text-red-400",
};

export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${CLASS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABEL[status]}
    </span>
  );
}
