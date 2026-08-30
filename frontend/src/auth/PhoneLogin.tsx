import { ArrowLeft, ArrowRight, Phone } from "lucide-react";

type PhoneLoginProps = {
  onBack: () => void;
};

export function PhoneLogin({ onBack }: PhoneLoginProps) {
  return (
    <div className="w-full">
      <h2 className="text-center text-[18px] font-semibold text-[#11213a]">Sign in with Phone</h2>

      <p className="mb-5 mt-2 text-center text-[13px] leading-5 text-[#98a5b8]">
        Enter your phone number to continue.
      </p>

      <form className="flex flex-col gap-2">
        <label htmlFor="phone-number" className="text-[12px] text-[#91a0b6]">
          Phone Number
        </label>

        <div
          className="
            flex min-h-[40px] items-center gap-2
            rounded-[8px]
            border border-[#d9e3f2]
            bg-[#eaf2ff]
            px-2.5
            focus-within:border-[#f47813]
            focus-within:ring-2
            focus-within:ring-[#f47813]/10
          "
        >
          <Phone className="h-4 w-4 text-[#a6b1c1]" strokeWidth={1.7} />

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
              text-[#111c2c]
              outline-none
              placeholder:text-[#98a5b8]
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
            bg-[#ff851b]
            px-4
            text-[13px]
            font-semibold
            text-white
            shadow-[0_5px_12px_rgba(255,133,27,0.18)]
            transition
            hover:bg-[#f47813]
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
          text-[#152642]
          transition
          hover:text-[#f47813]
        "
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        Back to Sign in
      </button>
    </div>
  );
}
