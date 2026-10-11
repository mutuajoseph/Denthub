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
        <h1 className="font-heading text-2xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          We could not load this part of DentHub. Try again, or return home to continue browsing.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-button bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-graphite"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-button border border-steel px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cloud"
          >
            Back to home
          </a>
        </div>
      </section>
    );
  }
}

export const AppErrorBoundary = ErrorBoundary;
