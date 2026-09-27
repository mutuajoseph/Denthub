import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone } from "lucide-react";
import { useState } from "react";

import { type AuthResponse, login } from "../lib/auth";

type SignInProps = {
  onLoginSuccess: (auth: AuthResponse) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
  onPhoneLogin: () => void;
};

export function SignIn({
  onLoginSuccess,
  onRegister,
  onForgotPassword,
  onPhoneLogin,
}: SignInProps) {
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
      <p className="mb-4 mt-1 text-center text-[13px] text-auth-muted">
        Welcome back to DentHub Kenya
      </p>

      <form className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
        {/* Email */}
        <label htmlFor="auth-email" className="text-[12px] text-auth-label">
          Email
        </label>

        <div
          className="
            flex
            min-h-[42px]
            items-center
            gap-2
            rounded-[8px]
            border
            border-auth-field-border
            bg-auth-field
            px-2.5
            transition
            focus-within:border-auth-accent-strong
            focus-within:ring-2
            focus-within:ring-auth-accent-strong/10
          "
        >
          <Mail className="h-4 w-4 shrink-0 text-auth-icon" strokeWidth={1.7} />

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
            className="
              min-w-0
              flex-1
              border-0
              bg-transparent
              p-0
              text-[13px]
              text-auth-heading
              outline-none
              placeholder:text-auth-muted
            "
          />
        </div>

        {/* Password */}
        <label htmlFor="auth-password" className="mt-1.5 text-[12px] text-auth-label">
          Password
        </label>

        <div
          className="
            flex
            min-h-[42px]
            items-center
            gap-2
            rounded-[8px]
            border
            border-auth-field-border
            bg-auth-field
            px-2.5
            transition
            focus-within:border-auth-accent-strong
            focus-within:ring-2
            focus-within:ring-auth-accent-strong/10
          "
        >
          <Lock className="h-4 w-4 shrink-0 text-auth-icon" strokeWidth={1.7} />

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
            className="
              min-w-0
              flex-1
              border-0
              bg-transparent
              p-0
              text-[13px]
              text-auth-heading
              outline-none
              placeholder:text-auth-muted
            "
          />

          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((value) => !value)}
            className="
              flex
              h-6
              w-6
              shrink-0
              items-center
              justify-center
              rounded-[5px]
              border-0
              bg-auth-toggle
              p-0
              text-white
              transition
              hover:bg-auth-toggle-hover
            "
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
            className="
              mt-2
              rounded-[7px]
              border
              border-red-400/40
              bg-red-500/10
              px-3
              py-2
              text-center
              text-[12px]
              text-red-300 dark:text-red-200
            "
          >
            {error}
          </div>
        )}

        {/* Sign In */}
        <button
          type="submit"
          disabled={loading}
          className="
            mt-2
            flex
            min-h-[42px]
            w-full
            items-center
            justify-center
            gap-1.5
            rounded-[8px]
            border-0
            bg-auth-accent
            px-4
            text-[13px]
            font-semibold
            text-white
            shadow-[0_5px_12px_rgba(255,133,27,0.18)]
            transition
            hover:bg-auth-accent-strong
            active:scale-[0.99]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {loading ? "Signing in..." : "Sign in"}

          {!loading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
        </button>

        {/* Google */}
        <button
          type="button"
          disabled={loading}
          className="
            flex
            min-h-[42px]
            w-full
            items-center
            justify-center
            gap-2
            rounded-[8px]
            border-2
            border-auth-accent
            bg-auth-surface
            px-4
            text-[13px]
            font-semibold
            text-auth-accent
            transition
            hover:bg-orange-500/10
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <span className="text-[15px] font-bold">G</span>
          Sign in with Google
        </button>

        {/* Phone */}
        <button
          type="button"
          disabled={loading}
          onClick={onPhoneLogin}
          className="
            mx-auto
            mt-1.5
            inline-flex
            items-center
            justify-center
            gap-1.5
            border-0
            bg-transparent
            p-0
            text-[13px]
            font-semibold
            text-auth-body
            transition
            hover:text-auth-accent-strong
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
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
        className="
          mx-auto
          mt-4
          block
          border-0
          bg-transparent
          p-0
          text-[13px]
          font-medium
          text-auth-accent
          transition
          hover:text-auth-accent-strong
          disabled:cursor-not-allowed
          disabled:opacity-60
        "
      >
        Forgot password?
      </button>

      {/* Register */}
      <p className="mt-2 text-center text-[12px] text-auth-muted">
        Don't have an account?{" "}
        <button
          type="button"
          disabled={loading}
          onClick={onRegister}
          className="
            border-0
            bg-transparent
            p-0
            font-semibold
            text-auth-accent
            transition
            hover:text-auth-accent-strong
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          Register
        </button>
      </p>
    </div>
  );
}
