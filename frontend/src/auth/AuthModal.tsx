import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { SignIn } from "./SignIn";
import Register from "./Register";
import { ForgotPassword } from "./ForgotPassword";
import { PhoneLogin } from "./PhoneLogin";

import type { AuthResponse } from "../lib/auth";

type AuthView = "signin" | "register" | "forgot" | "phone";

type AuthModalProps = {
  onClose: () => void;
  onLoginSuccess?: (auth: AuthResponse) => void;
};

export function AuthModal({
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const [view, setView] = useState<AuthView>("signin");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleLoginSuccess = (auth: AuthResponse) => {
    // Store token
    localStorage.setItem(
      "access_token",
      auth.access_token
    );

    // Notify parent application
    onLoginSuccess?.(auth);

    // Close authentication modal
    onClose();
  };

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        overflow-hidden
        bg-[#161b23]/60
        p-4
        backdrop-blur-[6px]
      "
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="
          relative
          w-full
          max-w-[400px]
          max-h-[90vh]
          overflow-hidden
          rounded-[16px]
          bg-white
          px-6
          py-5
          text-[#11213a]
          shadow-[0_20px_45px_rgba(0,0,0,0.22)]
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {/* Close */}
        <button
          type="button"
          aria-label="Close authentication"
          onClick={onClose}
          className="
            absolute
            right-3
            top-3
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-md
            border-0
            bg-transparent
            text-[#a2adbd]
            transition
            hover:text-[#66758a]
          "
        >
          <X
            className="h-5 w-5"
            strokeWidth={1.8}
          />
        </button>

        {/* Brand */}
        <div className="mb-5 flex justify-center">
          <h1
            id="auth-title"
            className="
              m-0
              text-[27px]
              font-bold
              leading-none
              tracking-tight
              text-[#11213a]
            "
          >
            Dent
            <span className="text-[#f47813]">
              Hub Kenya
            </span>
          </h1>
        </div>

        {/* Sign in */}
        {view === "signin" && (
          <SignIn
            onLoginSuccess={handleLoginSuccess}
            onRegister={() =>
              setView("register")
            }
            onForgotPassword={() =>
              setView("forgot")
            }
            onPhoneLogin={() =>
              setView("phone")
            }
          />
        )}

        {/* Register */}
        {view === "register" && (
          <Register
            onClose={onClose}
            onSignIn={() =>
              setView("signin")
            }
            onRegisterSuccess={
              handleLoginSuccess
            }
          />
        )}

        {/* Forgot password */}
        {view === "forgot" && (
          <ForgotPassword
            onBack={() =>
              setView("signin")
            }
          />
        )}

        {/* Phone login */}
        {view === "phone" && (
          <PhoneLogin
            onBack={() =>
              setView("signin")
            }
          />
        )}
      </section>
    </div>
  );
}
