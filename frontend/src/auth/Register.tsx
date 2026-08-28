import { useState } from "react";
import {
  X,
  User,
  Stethoscope,
  Plane,
  GraduationCap,
  Building2,
  Package,
  BookOpen,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

type RegisterProps = {
  onClose: () => void;
  onSignIn: () => void;
};

const ACCOUNT_TYPES = [
  {
    id: "patient",
    label: "Patient",
    description: "Book appointments and manage your dental care",
    icon: User,
  },
  {
    id: "dentist",
    label: "Dentist",
    description: "Manage your professional and clinic profile",
    icon: Stethoscope,
  },
  {
    id: "international",
    label: "International Patient",
    description: "Plan dental treatment and travel",
    icon: Plane,
  },
  {
    id: "intern",
    label: "Intern / Student",
    description: "Access training and CPD opportunities",
    icon: GraduationCap,
  },
  {
    id: "clinic",
    label: "Clinic / Employer",
    description: "Manage your clinic and staff",
    icon: Building2,
  },
  {
    id: "supplier",
    label: "Supplier",
    description: "Manage products, orders and logistics",
    icon: Package,
  },
  {
    id: "training",
    label: "Training Body",
    description: "Publish courses and issue certificates",
    icon: BookOpen,
  },
];

export default function Register({
  onClose,
  onSignIn,
}: RegisterProps) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const selectedAccount = ACCOUNT_TYPES.find(
    (account) => account.id === accountType
  );

  const selectAccount = (id: string) => {
    setAccountType(id);
    setStep(2);
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
        bg-transparent
        p-4
        backdrop-blur-[10px]
      "
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
        onClick={(e) => e.stopPropagation()}
        className="
          relative
          w-full
          max-w-[560px]
          max-h-[88vh]
          overflow-y-auto
          rounded-[12px]
          border
          border-[#d9e3f2]
          bg-white
          shadow-[0_20px_55px_rgba(21,38,66,0.16)]
          scrollbar-hide
        "
      >
        {/* Close */}
        <button
          type="button"
          aria-label="Close registration"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="
            absolute
            right-4
            top-4
            z-20
            flex
            h-8
            w-8
            cursor-pointer
            items-center
            justify-center
            rounded-[6px]
            border-0
            bg-transparent
            p-0
            text-[#98a5b8]
            transition
            hover:bg-[#eaf2ff]
            hover:text-[#152642]
          "
        >
          <X
            className="h-4 w-4"
            strokeWidth={2}
          />
        </button>

        <div className="px-6 py-6">

          {/* Brand */}
          <div className="mb-5 text-center">
            <h1
              id="register-title"
              className="
                text-[24px]
                font-extrabold
                tracking-tight
                text-[#152642]
              "
            >
              Dent
              <span className="text-[#ff851b]">
                Hub Kenya
              </span>
            </h1>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <div className="mb-5 text-center">
                <h2 className="text-[20px] font-bold text-[#152642]">
                  Join DentHub Kenya
                </h2>

                <p className="mt-1 text-[13px] text-[#98a5b8]">
                  Choose how you'll use DentHub
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ACCOUNT_TYPES.map((account) => {
                  const Icon = account.icon;

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => selectAccount(account.id)}
                      className="
                        group
                        flex
                        items-start
                        gap-3
                        rounded-[8px]
                        border
                        border-[#d9e3f2]
                        bg-[#f8fbff]
                        p-3
                        text-left
                        transition
                        hover:border-[#ff851b]
                        hover:bg-[#fff7f0]
                      "
                    >
                      <div
                        className="
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-[7px]
                          bg-[#eaf2ff]
                          text-[#ff851b]
                          transition
                          group-hover:bg-[#fff0e3]
                        "
                      >
                        <Icon
                          className="h-4 w-4"
                          strokeWidth={1.7}
                        />
                      </div>

                      <div>
                        <h3 className="text-[13px] font-semibold text-[#152642]">
                          {account.label}
                        </h3>

                        <p className="mt-0.5 text-[11px] leading-4 text-[#98a5b8]">
                          {account.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <div className="mb-5 text-center">
                <h2 className="text-[20px] font-bold text-[#152642]">
                  Create your account
                </h2>

                <p className="mt-1 text-[13px] text-[#98a5b8]">
                  {selectedAccount?.label} · Kenya
                </p>
              </div>

              <form className="flex flex-col gap-1.5">

                {/* Full Name */}
                <label
                  htmlFor="full-name"
                  className="text-[12px] text-[#91a0b6]"
                >
                  Full name
                </label>

                <div
                  className="
                    flex
                    min-h-[42px]
                    items-center
                    gap-2
                    rounded-[8px]
                    border
                    border-[#d9e3f2]
                    bg-[#eaf2ff]
                    px-2.5
                    focus-within:border-[#f47813]
                    focus-within:ring-2
                    focus-within:ring-[#f47813]/10
                  "
                >
                  <User className="h-4 w-4 text-[#a6b1c1]" />

                  <input
                    id="full-name"
                    type="text"
                    placeholder="Jane Doe"
                    required
                    className="
                      min-w-0
                      flex-1
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

                {/* Email */}
                <label
                  htmlFor="email"
                  className="mt-1.5 text-[12px] text-[#91a0b6]"
                >
                  Email
                </label>

                <div
                  className="
                    flex
                    min-h-[42px]
                    items-center
                    gap-2
                    rounded-[8px]
                    border
                    border-[#d9e3f2]
                    bg-[#eaf2ff]
                    px-2.5
                    focus-within:border-[#f47813]
                    focus-within:ring-2
                    focus-within:ring-[#f47813]/10
                  "
                >
                  <Mail className="h-4 w-4 text-[#a6b1c1]" />

                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    required
                    className="
                      min-w-0
                      flex-1
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

                {/* Phone */}
                <label
                  htmlFor="phone"
                  className="mt-1.5 text-[12px] text-[#91a0b6]"
                >
                  Phone{" "}
                  <span className="text-[#a6b1c1]">
                    (optional)
                  </span>
                </label>

                <div
                  className="
                    flex
                    min-h-[42px]
                    items-center
                    gap-2
                    rounded-[8px]
                    border
                    border-[#d9e3f2]
                    bg-[#eaf2ff]
                    px-2.5
                    focus-within:border-[#f47813]
                    focus-within:ring-2
                    focus-within:ring-[#f47813]/10
                  "
                >
                  <Phone className="h-4 w-4 text-[#a6b1c1]" />

                  <input
                    id="phone"
                    type="tel"
                    placeholder="+254 712 345 678"
                    className="
                      min-w-0
                      flex-1
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

                {/* Password */}
                <label
                  htmlFor="password"
                  className="mt-1.5 text-[12px] text-[#91a0b6]"
                >
                  Password
                </label>

                <div
                  className="
                    flex
                    min-h-[42px]
                    items-center
                    gap-2
                    rounded-[8px]
                    border
                    border-[#d9e3f2]
                    bg-[#eaf2ff]
                    px-2.5
                    focus-within:border-[#f47813]
                    focus-within:ring-2
                    focus-within:ring-[#f47813]/10
                  "
                >
                  <Lock className="h-4 w-4 text-[#a6b1c1]" />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    className="
                      min-w-0
                      flex-1
                      border-0
                      bg-transparent
                      p-0
                      text-[13px]
                      text-[#111c2c]
                      outline-none
                      placeholder:text-[#98a5b8]
                    "
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    className="
                      flex
                      h-6
                      w-6
                      shrink-0
                      items-center
                      justify-center
                      rounded-[5px]
                      border-0
                      bg-[#b8c3d2]
                      p-0
                      text-white
                      transition
                      hover:bg-[#a8b4c5]
                    "
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Create Account */}
                <button
                  type="submit"
                  className="
                    mt-2
                    min-h-[42px]
                    w-full
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
                    active:scale-[0.99]
                  "
                >
                  Create account
                </button>

                {/* Back */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="
                    mx-auto
                    mt-1
                    border-0
                    bg-transparent
                    p-0
                    text-[12px]
                    font-medium
                    text-[#152642]
                    transition
                    hover:text-[#f47813]
                  "
                >
                  ← Change account type
                </button>
              </form>
            </>
          )}

          {/* Sign In */}
          <p className="mt-4 text-center text-[12px] text-[#98a5b8]">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSignIn}
              className="
                border-0
                bg-transparent
                p-0
                font-semibold
                text-[#ff851b]
                transition
                hover:text-[#f47813]
              "
            >
              Sign in
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
