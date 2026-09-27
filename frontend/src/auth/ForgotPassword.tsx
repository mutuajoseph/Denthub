import { ArrowLeft, ArrowRight, Mail } from "lucide-react";

type ForgotPasswordProps = {
  onBack: () => void;
};

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  return (
    <div className="w-full">
      <h2 className="text-center text-[18px] font-semibold text-auth-heading">
        Forgot your password?
      </h2>

      <p className="mb-5 mt-2 text-center text-[13px] leading-5 text-auth-muted">
        Enter your email address and we'll help you reset your password.
      </p>

      <form className="flex flex-col gap-2">
        <label htmlFor="forgot-email" className="text-[12px] text-auth-label">
          Email
        </label>

        <div
          className="
            flex min-h-[40px] items-center gap-2
            rounded-[8px]
            border border-auth-field-border
            bg-auth-field
            px-2.5
            focus-within:border-auth-accent-strong
            focus-within:ring-2
            focus-within:ring-auth-accent-strong/10
          "
        >
          <Mail className="h-4 w-4 text-auth-icon" strokeWidth={1.7} />

          <input
            id="forgot-email"
            type="email"
            placeholder="Enter your email"
            className="
              min-w-0 flex-1
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

        <button
          type="button"
          className="
            mt-2
            flex min-h-[40px] w-full
            items-center justify-center gap-2
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
          "
        >
          Send Reset Link
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="
          mx-auto mt-4
          flex items-center gap-1.5
          border-0
          bg-transparent
          p-0
          text-[13px]
          font-semibold
          text-auth-body
          transition
          hover:text-auth-accent-strong
        "
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        Back to Sign in
      </button>
    </div>
  );
}
