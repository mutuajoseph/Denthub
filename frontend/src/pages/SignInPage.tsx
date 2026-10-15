import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AuthPanel, type AuthView } from "../auth/AuthPanel";
import type { AuthResponse } from "../lib/auth";

type SignInPageProps = {
  onSuccess: (auth: AuthResponse) => void;
};

type SignInLocationState = { returnTo?: unknown } | null;

/** Only trust a same-origin, internal return path supplied by the guard. */
function safeReturnTo(state: SignInLocationState): string {
  const returnTo = state?.returnTo;

  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\")
  ) {
    return returnTo;
  }

  return "/dashboard";
}

export function SignInPage({ onSuccess }: SignInPageProps) {
  const [view, setView] = useState<AuthView>("signin");
  const location = useLocation();
  const navigate = useNavigate();

  const handleSuccess = (auth: AuthResponse) => {
    onSuccess(auth);
    navigate(safeReturnTo(location.state as SignInLocationState), { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-[420px] px-4 py-12">
      <h1 className="mb-5 text-center font-display text-[27px] leading-none font-semibold tracking-[-0.03em] text-ink">
        Sign in to your account
      </h1>
      <div className="rounded-card border border-steel bg-paper px-6 py-5 text-ink shadow-card-cloud">
        <AuthPanel
          view={view}
          onViewChange={setView}
          onSuccess={handleSuccess}
          onClose={() => navigate("/")}
        />
      </div>
    </section>
  );
}
