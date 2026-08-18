import { useEffect, useState } from "react";
import { ToothMark } from "./components/ToothMark";
import { type HealthStatus, fetchHealth } from "./lib/api";

type BackendState =
  | { kind: "loading" }
  | { kind: "ready"; health: HealthStatus }
  | { kind: "error"; message: string };

const STACK = ["React 19", "Vite", "FastAPI", "TypeScript"];

export function App() {
  const [backend, setBackend] = useState<BackendState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((health) => {
        if (active) setBackend({ kind: "ready", health });
      })
      .catch((err: unknown) => {
        if (active) {
          setBackend({
            kind: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page">
      <div className="glow glow--a" aria-hidden="true" />
      <div className="glow glow--b" aria-hidden="true" />

      <section className="card">
        <div className="logo">
          <ToothMark />
        </div>
        <p className="eyebrow">Dental practice platform</p>
        <h1 className="title">
          Welcome to <span className="title-accent">DentistHub</span>
        </h1>
        <p className="subtitle">
          The frontend is live — a React&nbsp;+&nbsp;Vite client wired to a FastAPI backend.
        </p>

        <StatusPill state={backend} />

        <ul className="stack" aria-label="Tech stack">
          {STACK.map((item) => (
            <li key={item} className="chip">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <footer className="footnote">
        <code>localhost:5173</code> proxying <code>/api</code> → FastAPI
      </footer>
    </main>
  );
}

function StatusPill({ state }: { state: BackendState }) {
  const { modifier, key, value } = describe(state);
  return (
    <output className={`status ${modifier}`} aria-live="polite">
      <span className="dot" />
      <span className="status-key">{key}</span>
      <span className="status-value">{value}</span>
    </output>
  );
}

function describe(state: BackendState): { modifier: string; key: string; value: string } {
  switch (state.kind) {
    case "loading":
      return { modifier: "status--pending", key: "Backend", value: "connecting…" };
    case "error":
      return { modifier: "status--error", key: "Backend", value: "offline" };
    case "ready":
      return { modifier: "status--ok", key: state.health.service, value: state.health.message };
  }
}
