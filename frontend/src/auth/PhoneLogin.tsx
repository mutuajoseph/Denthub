import { ArrowLeft, ArrowRight, Phone } from "lucide-react";

type PhoneLoginProps = {
  onBack: () => void;
};

const fieldShellClass =
  "flex min-h-[44px] items-center gap-2 rounded-button border border-steel bg-cloud px-3 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10";
const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-slate";

export function PhoneLogin({ onBack }: PhoneLoginProps) {
  return (
    <div className="w-full">
      <h2 className="text-center font-heading text-[18px] font-semibold text-ink">
        Sign in with Phone
      </h2>

      <p className="mt-2 mb-5 text-center text-[13px] leading-5 text-slate">
        Enter your phone number to continue.
      </p>

      <form className="flex flex-col gap-2">
        <label htmlFor="phone-number" className="text-xs font-medium text-charcoal">
          Phone Number
        </label>

        <div className={fieldShellClass}>
          <Phone className="h-4 w-4 text-slate" strokeWidth={1.7} />

          <input
            id="phone-number"
            type="tel"
            placeholder="+254 700 000 000"
            className={inputClass}
          />
        </div>

        <button
          type="button"
          className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-button border-0 bg-aqua-relay px-4 text-sm font-semibold text-ink transition hover:bg-aqua-relay-deep"
        >
          Continue
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mx-auto mt-4 flex items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-semibold text-charcoal transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        Back to Sign in
      </button>
    </div>
  );
}
