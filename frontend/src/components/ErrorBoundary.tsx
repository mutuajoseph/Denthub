import { Component, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <section
        role="alert"
        aria-live="assertive"
        className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center"
      >
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-orange-500 dark:text-gold-400">
          DentHub
        </p>
        <h1 className="mt-4 font-heading text-2xl font-bold text-slate-900 dark:text-white">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-gray-300">
          We could not load this part of DentHub. Try again, or return home to continue browsing.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-500 transition-colors hover:bg-orange-50 dark:border-gold-400 dark:text-gold-300 dark:hover:bg-gold-400/10"
          >
            Back to home
          </a>
        </div>
      </section>
    );
  }
}

export const AppErrorBoundary = ErrorBoundary;
