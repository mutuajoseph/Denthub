import { ArrowLeft, ArrowRight, Phone } from "lucide-react";

type PhoneLoginProps = {
  onBack: () => void;
};

export function PhoneLogin({ onBack }: PhoneLoginProps) {
  return (
    <div className="w-full">
      <h2 className="text-center text-[18px] font-semibold text-auth-heading">
        Sign in with Phone
      </h2>

      <p className="mb-5 mt-2 text-center text-[13px] leading-5 text-auth-muted">
        Enter your phone number to continue.
      </p>

      <form className="flex flex-col gap-2">
        <label htmlFor="phone-number" className="text-[12px] text-auth-label">
          Phone Number
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
          <Phone className="h-4 w-4 text-auth-icon" strokeWidth={1.7} />

          <input
            id="phone-number"
            type="tel"
            placeholder="+254 700 000 000"
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
          Continue
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
