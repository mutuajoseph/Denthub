import { type FormEvent, useState } from "react";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useChangePassword, useResendVerificationEmail } from "../hooks/useAccount";
import { ApiError } from "../lib/apiClient";
import type { AuthResponse, AuthUser } from "../lib/auth";

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  "min-h-[44px] w-full rounded-button border border-steel bg-cloud px-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10";

type AccountSettingsProps = {
  user: AuthUser | null;
  onAuthChanged?: (auth: AuthResponse) => void;
};

/**
 * Account settings for any signed-in public User (#141): change the password
 * and, until the email is verified, ask for a fresh verification link.
 */
export function AccountSettings({ user, onAuthChanged }: AccountSettingsProps) {
  const changePassword = useChangePassword();
  const resend = useResendVerificationEmail();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [resendDismissed, setResendDismissed] = useState(false);

  if (!user) {
    return null;
  }

  const handleChangePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword !== confirm) {
      setMismatch(true);
      return;
    }

    setMismatch(false);
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: (auth) => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirm("");
          onAuthChanged?.(auth);
        },
      },
    );
  };

  const handleResend = () => {
    resend.mutate(undefined, {
      onError: (error) => {
        // A 409 means another tab already verified the email; hide the notice.
        if (error instanceof ApiError && error.status === 409) {
          setResendDismissed(true);
        }
      },
    });
  };

  const showResendNotice = !user.email_verified && !resendDismissed;

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Account settings
        </h1>
        <p className="mt-2 text-sm text-slate">Signed in as {user.full_name}</p>
      </header>

      <div className="grid gap-4">
        {showResendNotice && (
          <Card tone="white" hover={false}>
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
              Verify your email
            </h2>
            <p className="mt-2 text-sm text-charcoal">
              We haven't confirmed that {user.email} belongs to you yet.
            </p>

            {resend.status === "success" ? (
              <output className="mt-3 block text-sm text-charcoal">
                We've sent a new verification link to {user.email}.
              </output>
            ) : (
              <>
                {resend.status === "error" && (
                  <p role="alert" className="mt-3 text-[13px] text-red-700">
                    {resend.error.message}
                  </p>
                )}
                <Button
                  variant="secondary"
                  onClick={handleResend}
                  disabled={resend.status === "pending"}
                  className="mt-3"
                >
                  {resend.status === "pending" ? "Sending…" : "Resend verification email"}
                </Button>
              </>
            )}
          </Card>
        )}

        <Card tone="white" hover={false}>
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
            Change password
          </h2>
          <p className="mt-2 text-sm text-charcoal">
            Changing your password signs you out on every other device.
          </p>

          {changePassword.status === "success" ? (
            <output className="mt-4 block text-sm text-charcoal">
              Your password is changed. You're still signed in here, and every other session has
              ended.
            </output>
          ) : (
            <form
              className="mt-4 flex max-w-[420px] flex-col gap-2"
              onSubmit={handleChangePassword}
            >
              <label htmlFor="current-password" className="text-xs font-medium text-charcoal">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                required
                autoComplete="current-password"
                className={inputClass}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />

              <label htmlFor="new-password" className="mt-2 text-xs font-medium text-charcoal">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                className={inputClass}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
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
              <p className="text-[12px] text-slate">
                At least {MIN_PASSWORD_LENGTH} characters, up to 72 bytes.
              </p>

              {mismatch && (
                <p role="alert" className="text-[13px] text-red-700">
                  The passwords don't match.
                </p>
              )}
              {!mismatch && changePassword.status === "error" && (
                <p role="alert" className="text-[13px] text-red-700">
                  {changePassword.error.message}
                </p>
              )}

              <Button
                type="submit"
                disabled={changePassword.status === "pending"}
                className="mt-2 w-full"
              >
                {changePassword.status === "pending" ? "Saving…" : "Change password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </section>
  );
}
