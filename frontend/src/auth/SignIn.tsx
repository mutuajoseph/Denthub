import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone } from "lucide-react";
import { useState } from "react";

import { useRegion } from "../hooks/useRegion";
import { type AuthResponse, login } from "../lib/auth";

type SignInProps = {
  onLoginSuccess: (auth: AuthResponse) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
  onPhoneLogin: () => void;
};

const fieldShellClass =
  "flex min-h-[44px] items-center gap-2 rounded-button border border-steel bg-cloud px-3 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10";
const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-slate";
const labelClass = "text-xs font-medium text-charcoal";

export function SignIn({
  onLoginSuccess,
  onRegister,
  onForgotPassword,
  onPhoneLogin,
}: SignInProps) {
  const { brandName } = useRegion();
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
      const response = await login({
        email: email.trim(),
        password,
      });

      /*
       * Pass the successful authentication response
       * back to AuthModal.
       */
      onLoginSuccess(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Welcome */}
      <p className="mt-1 mb-4 text-center text-[13px] text-slate">Welcome back to {brandName}</p>

      <form className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
        {/* Email */}
        <label htmlFor="auth-email" className={labelClass}>
          Email
        </label>

        <div className={fieldShellClass}>
          <Mail className="h-4 w-4 shrink-0 text-slate" strokeWidth={1.7} />

          <input
            id="auth-email"
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

        {/* Password */}
        <label htmlFor="auth-password" className={`${labelClass} mt-1.5`}>
          Password
        </label>

        <div className={fieldShellClass}>
          <Lock className="h-4 w-4 shrink-0 text-slate" strokeWidth={1.7} />

          <input
            id="auth-password"
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
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border-0 bg-ink p-0 text-paper transition hover:bg-graphite"
          >
            {showPassword ? (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.8} />
            ) : (
              <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mt-2 rounded-button border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700"
          >
            {error}
          </div>
        )}

        {/* Sign In */}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-button border-0 bg-aqua-relay px-4 text-sm font-semibold text-ink transition hover:bg-aqua-relay-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}

          {!loading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
        </button>

        {/* Google */}
        <button
          type="button"
          disabled={loading}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border border-steel bg-paper px-4 text-sm font-semibold text-ink transition hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-[15px] font-bold">G</span>
          Sign in with Google
        </button>

        {/* Phone */}
        <button
          type="button"
          disabled={loading}
          onClick={onPhoneLogin}
          className="mx-auto mt-1.5 inline-flex items-center justify-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-semibold text-charcoal transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Phone className="h-4 w-4" strokeWidth={1.8} />
          Continue with Phone Number
        </button>
      </form>

      {/* Forgot Password */}
      <button
        type="button"
        disabled={loading}
        onClick={onForgotPassword}
        className="mx-auto mt-4 block border-0 bg-transparent p-0 text-[13px] font-medium text-charcoal transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        Forgot password?
      </button>

      {/* Register */}
      <p className="mt-2 text-center text-[12px] text-slate">
        Don't have an account?{" "}
        <button
          type="button"
          disabled={loading}
          onClick={onRegister}
          className="border-0 bg-transparent p-0 font-semibold text-ink transition hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-60"
        >
          Register
        </button>
      </p>
    </div>
  );
}
