import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The last line of defense against a blank screen: any render error
 * anywhere in the tree below lands here instead of leaving a white page
 * with no explanation.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro não tratado na interface:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="font-display text-xl font-semibold">Algo deu errado</h1>
        <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
          Encontramos um erro inesperado ao carregar esta tela. Você pode tentar novamente.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white hover:bg-verse-500"
        >
          Tentar novamente
        </button>
        <details className="mt-2 w-full text-left text-xs text-ink-700/50 dark:text-parchment-100/40">
          <summary className="cursor-pointer text-center">Ver detalhes</summary>
          <p className="mt-1 break-words font-mono">{error.message}</p>
        </details>
      </div>
    );
  }
}
