import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import Button from "../components/ui/Button";
import { useVerifyEmail } from "../hooks/useAccount";

/**
 * Landing page for the emailed verification link (#120). The token is spent
 * on a click, not on load: mail scanners that open links must not use it up,
 * and a double render must not spend it twice.
 */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const verify = useVerifyEmail();

  return (
    <section className="mx-auto w-full max-w-[420px] px-4 py-12">
      <h1 className="mb-5 text-center font-display text-[27px] leading-none font-semibold tracking-[-0.03em] text-ink">
        Confirm your email
      </h1>
      <div className="rounded-card border border-steel bg-paper px-6 py-5 text-center text-ink shadow-card-cloud">
        {!token ? (
          <p role="alert" className="text-sm text-charcoal">
            This link is missing its token. Open the link from your email again.
          </p>
        ) : verify.status === "success" ? (
          <output className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-ink" strokeWidth={1.6} />
            <p className="text-sm text-charcoal">Your email is confirmed.</p>
            <Button to="/" variant="secondary">
              Back to DentHub
            </Button>
          </output>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-charcoal">
              Confirm that this email address belongs to your DentHub account.
            </p>
            {verify.status === "error" && (
              <p role="alert" className="text-[13px] text-red-700">
                {verify.error.message} Sign in to send yourself a new link.
              </p>
            )}
            <Button
              onClick={() => verify.mutate(token)}
              disabled={verify.status === "pending"}
              className="w-full"
            >
              {verify.status === "pending" ? "Confirming…" : "Confirm my email"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
