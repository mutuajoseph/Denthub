import type { AuthResponse } from "../lib/auth";
import { ForgotPassword } from "./ForgotPassword";
import { PhoneLogin } from "./PhoneLogin";
import Register from "./Register";
import { SignIn } from "./SignIn";

export type AuthView = "signin" | "register" | "forgot" | "phone";

export type AuthPanelProps = {
  view: AuthView;
  onViewChange: (view: AuthView) => void;
  onSuccess: (auth: AuthResponse) => void;
  onClose: () => void;
};

/**
 * The sign-in / register / forgot / phone flow, without any surface chrome.
 * `AuthModal` and the routed `/sign-in` page both own the surrounding layout and
 * the current `view`, so the two stay in step.
 */
export function AuthPanel({ view, onViewChange, onSuccess, onClose }: AuthPanelProps) {
  return (
    <>
      {view === "signin" && (
        <SignIn
          onLoginSuccess={onSuccess}
          onRegister={() => onViewChange("register")}
          onForgotPassword={() => onViewChange("forgot")}
          onPhoneLogin={() => onViewChange("phone")}
        />
      )}

      {view === "register" && (
        <Register
          onClose={onClose}
          onSignIn={() => onViewChange("signin")}
          onRegisterSuccess={onSuccess}
        />
      )}

      {view === "forgot" && <ForgotPassword onBack={() => onViewChange("signin")} />}

      {view === "phone" && <PhoneLogin onBack={() => onViewChange("signin")} />}
    </>
  );
}
