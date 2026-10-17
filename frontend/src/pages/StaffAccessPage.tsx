import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useRegion } from "../hooks/useRegion";
import { type AuthResponse, loginStaff } from "../lib/auth";

type StaffAccessPageProps = {
  onSuccess: (auth: AuthResponse) => void;
};

type StaffAccessLocationState = { returnTo?: unknown } | null;

/** Only trust a same-origin, internal return path supplied by the guard. */
function safeReturnTo(state: StaffAccessLocationState): string {
  const returnTo = state?.returnTo;

  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\")
  ) {
    return returnTo;
  }

  return "/";
}

const fieldShellClass =
  "flex min-h-[44px] items-center gap-2 rounded-button border border-steel bg-cloud px-3 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10";
const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-slate";
const labelClass = "text-xs font-medium text-charcoal";

/**
 * The staff surface (PRD §6, issue #80): a standalone sign-in for DentHub's own
 * Admins and Operators, deliberately unlinked from the public login. A staff
 * role is granted by other staff, never chosen here, so the page offers no
 * register, social, or phone options.
 */
export function StaffAccessPage({ onSuccess }: StaffAccessPageProps) {
  const { brandName } = useRegion();
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await loginStaff({ email: email.trim(), password });
      onSuccess(response);
      navigate(safeReturnTo(location.state as StaffAccessLocationState), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[420px] px-4 py-12">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-steel bg-cloud px-3 py-1 text-[12px] font-semibold text-charcoal">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
          DentHub Staff
        </span>
        <h1 className="font-display text-[27px] leading-none font-semibold tracking-[-0.03em] text-ink">
          Staff sign in
        </h1>
        <p className="text-[13px] text-slate">
          Internal access for {brandName} Admins and Operators only.
        </p>
      </div>

      <div className="rounded-card border border-steel bg-paper px-6 py-5 text-ink shadow-card-cloud">
        <form className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
          <label htmlFor="staff-email" className={labelClass}>
            Email
          </label>

          <div className={fieldShellClass}>
            <Mail className="h-4 w-4 shrink-0 text-slate" strokeWidth={1.7} />

            <input
              id="staff-email"
              name="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              className={inputClass}
            />
          </div>

          <label htmlFor="staff-password" className={`${labelClass} mt-1.5`}>
            Password
          </label>

          <div className={fieldShellClass}>
            <Lock className="h-4 w-4 shrink-0 text-slate" strokeWidth={1.7} />

            <input
              id="staff-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              className={inputClass}
            />

            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="rounded-link border-0 bg-transparent p-0 text-[12px] font-semibold text-charcoal transition hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-2 rounded-button border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-button border-0 bg-aqua-relay px-4 text-sm font-semibold text-ink transition hover:bg-aqua-relay-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in to staff console"}

            {!loading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
          </button>
        </form>
      </div>
    </section>
  );
}
