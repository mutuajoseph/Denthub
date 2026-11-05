import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Button from "../components/ui/Button";
import { useResetPassword } from "../hooks/useAccount";

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  "min-h-[44px] w-full rounded-button border border-steel bg-cloud px-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10";

/** Landing page for the emailed reset link (#120): choose a new password. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    reset.mutate({ token, newPassword: password });
  };

  return (
    <section className="mx-auto w-full max-w-[420px] px-4 py-12">
      <h1 className="mb-5 text-center font-display text-[27px] leading-none font-semibold tracking-[-0.03em] text-ink">
        Choose a new password
      </h1>
      <div className="rounded-card border border-steel bg-paper px-6 py-5 text-ink shadow-card-cloud">
        {!token ? (
          <p role="alert" className="text-center text-sm text-charcoal">
            This link is missing its token. Open the link from your email again.
          </p>
        ) : reset.status === "success" ? (
          <output className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-charcoal">
              Your password is changed, and you've been signed out everywhere else.
            </p>
            <Button to="/sign-in">Sign in</Button>
          </output>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <label htmlFor="new-password" className="text-xs font-medium text-charcoal">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <label htmlFor="confirm-password" className="mt-2 text-xs font-medium text-charcoal">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            <p className="text-[12px] text-slate">At least {MIN_PASSWORD_LENGTH} characters.</p>

            {mismatch && (
              <p role="alert" className="text-[13px] text-red-700">
                The passwords don't match.
              </p>
            )}
            {reset.status === "error" && (
              <p role="alert" className="text-[13px] text-red-700">
                {reset.error.message}
              </p>
            )}

            <Button type="submit" disabled={reset.status === "pending"} className="mt-2 w-full">
              {reset.status === "pending" ? "Saving…" : "Set new password"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
