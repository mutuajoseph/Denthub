import {
  BookOpen,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  Package,
  Phone,
  Plane,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { useState } from "react";

import { type AuthResponse, register } from "../lib/auth";
import { ROLE } from "./roles";

type RegisterProps = {
  onClose: () => void;
  onSignIn: () => void;
  onRegisterSuccess?: (auth: AuthResponse) => void;
};

const ACCOUNT_TYPES = [
  {
    id: "patient",
    role: ROLE.PATIENT,
    label: "Patient",
    description: "Book appointments and manage your dental care",
    icon: User,
  },
  {
    id: "dentist",
    role: ROLE.DENTIST,
    label: "Dentist",
    description: "Manage your professional and clinic profile",
    icon: Stethoscope,
  },
  {
    id: "international",
    role: ROLE.INTERNATIONAL_PATIENT,
    label: "International Patient",
    description: "Plan dental treatment and travel",
    icon: Plane,
  },
  {
    id: "intern",
    role: ROLE.INTERN,
    label: "Intern / Student",
    description: "Access training and CPD opportunities",
    icon: GraduationCap,
  },
  {
    id: "clinic",
    role: ROLE.FACILITY_OWNER,
    label: "Clinic / Employer",
    description: "Manage your clinic and staff",
    icon: Building2,
  },
  {
    id: "supplier",
    role: ROLE.SUPPLIER,
    label: "Supplier",
    description: "Manage products, orders and logistics",
    icon: Package,
  },
  {
    id: "training",
    role: ROLE.TRAINING_PROVIDER,
    label: "Training Body",
    description: "Publish courses and issue certificates",
    icon: BookOpen,
  },
] as const;

type AccountTypeId = (typeof ACCOUNT_TYPES)[number]["id"];

export default function Register({ onClose, onSignIn, onRegisterSuccess }: RegisterProps) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountTypeId | "">("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedAccount = ACCOUNT_TYPES.find((account) => account.id === accountType);

  const selectAccount = (id: AccountTypeId) => {
    setAccountType(id);
    setError("");
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedAccount) {
      setError("Please select an account type.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role: selectedAccount.role,
      });

      onRegisterSuccess?.(response);

      /*
       * Close the authentication modal.
       *
       * The user is already logged in, so
       * we DO NOT send them back to Sign In.
       */
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
        bg-black/10
        p-4
        backdrop-blur-[10px]
      "
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <dialog
        open
        aria-labelledby="register-title"
        className="
          relative
          w-full
          max-w-[560px]
          max-h-[88vh]
          overflow-y-auto
          rounded-[12px]
          border
          border-auth-field-border
          bg-auth-surface
          shadow-[0_20px_55px_rgba(21,38,66,0.16)]
          scrollbar-hide
        "
      >
        {/* Close */}
        <button
          type="button"
          aria-label="Close registration"
          onClick={onClose}
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
            text-auth-muted
            transition
            hover:bg-auth-field
            hover:text-auth-body
          "
        >
          <X className="h-4 w-4" strokeWidth={2} />
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
                text-auth-body
              "
            >
              Dent
              <span className="text-auth-accent">Hub Kenya</span>
            </h1>
          </div>

          {/* =========================
              STEP 1 - ACCOUNT TYPE
          ========================== */}
          {step === 1 && (
            <>
              <div className="mb-5 text-center">
                <h2 className="text-[20px] font-bold text-auth-body">Join DentHub Kenya</h2>

                <p className="mt-1 text-[13px] text-auth-muted">Choose how you'll use DentHub</p>
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
                        border-auth-field-border
                        bg-auth-card
                        p-3
                        text-left
                        transition
                        hover:border-auth-accent
                        hover:bg-auth-card-hover
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
                          bg-auth-field
                          text-auth-accent
                          transition
                          group-hover:bg-auth-chip-hover
                        "
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.7} />
                      </div>

                      <div>
                        <h3 className="text-[13px] font-semibold text-auth-body">
                          {account.label}
                        </h3>

                        <p className="mt-0.5 text-[11px] leading-4 text-auth-muted">
                          {account.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* =========================
              STEP 2 - REGISTRATION
          ========================== */}
          {step === 2 && (
            <>
              <div className="mb-5 text-center">
                <h2 className="text-[20px] font-bold text-auth-body">Create your account</h2>

                <p className="mt-1 text-[13px] text-auth-muted">{selectedAccount?.label} · Kenya</p>
              </div>

              <form className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
                {/* Full Name */}
                <label htmlFor="full-name" className="text-[12px] text-auth-label">
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
                    border-auth-field-border
                    bg-auth-field
                    px-2.5
                    focus-within:border-auth-accent-strong
                    focus-within:ring-2
                    focus-within:ring-auth-accent-strong/10
                  "
                >
                  <User className="h-4 w-4 text-auth-icon" />

                  <input
                    id="full-name"
                    name="full_name"
                    type="text"
                    placeholder="Jane Doe"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="
                      min-w-0
                      flex-1
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

                {/* Email */}
                <label htmlFor="email" className="mt-1.5 text-[12px] text-auth-label">
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
                    border-auth-field-border
                    bg-auth-field
                    px-2.5
                    focus-within:border-auth-accent-strong
                    focus-within:ring-2
                    focus-within:ring-auth-accent-strong/10
                  "
                >
                  <Mail className="h-4 w-4 text-auth-icon" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="
                      min-w-0
                      flex-1
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

                {/* Phone */}
                <label htmlFor="phone" className="mt-1.5 text-[12px] text-auth-label">
                  Phone <span className="text-auth-icon">(optional)</span>
                </label>

                <div
                  className="
                    flex
                    min-h-[42px]
                    items-center
                    gap-2
                    rounded-[8px]
                    border
                    border-auth-field-border
                    bg-auth-field
                    px-2.5
                    focus-within:border-auth-accent-strong
                    focus-within:ring-2
                    focus-within:ring-auth-accent-strong/10
                  "
                >
                  <Phone className="h-4 w-4 text-auth-icon" />

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+254 712 345 678"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="
                      min-w-0
                      flex-1
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

                {/* Password */}
                <label htmlFor="password" className="mt-1.5 text-[12px] text-auth-label">
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
                    border-auth-field-border
                    bg-auth-field
                    px-2.5
                    focus-within:border-auth-accent-strong
                    focus-within:ring-2
                    focus-within:ring-auth-accent-strong/10
                  "
                >
                  <Lock className="h-4 w-4 text-auth-icon" />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="
                      min-w-0
                      flex-1
                      border-0
                      bg-transparent
                      p-0
                      text-[13px]
                      text-auth-heading
                      outline-none
                      placeholder:text-auth-muted
                    "
                  />

                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                    className="
                      flex
                      h-6
                      w-6
                      shrink-0
                      items-center
                      justify-center
                      rounded-[5px]
                      border-0
                      bg-auth-toggle
                      p-0
                      text-white
                      transition
                      hover:bg-auth-toggle-hover
                    "
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                    ) : (
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
                    )}
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <div
                    role="alert"
                    className="
                      mt-2
                      rounded-[7px]
                      border
                      border-red-400/40
                      bg-red-500/10
                      px-3
                      py-2
                      text-center
                      text-[12px]
                      text-red-300 dark:text-red-200
                    "
                  >
                    {error}
                  </div>
                )}

                {/* Create Account */}
                <button
                  type="submit"
                  disabled={loading}
                  className="
                    mt-2
                    min-h-[42px]
                    w-full
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
                    active:scale-[0.99]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>

                {/* Back */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setStep(1);
                  }}
                  className="
                    mx-auto
                    mt-1
                    border-0
                    bg-transparent
                    p-0
                    text-[12px]
                    font-medium
                    text-auth-body
                    transition
                    hover:text-auth-accent-strong
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  ← Change account type
                </button>
              </form>
            </>
          )}

          {/* Sign In */}
          <p className="mt-4 text-center text-[12px] text-auth-muted">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSignIn}
              className="
                border-0
                bg-transparent
                p-0
                font-semibold
                text-auth-accent
                transition
                hover:text-auth-accent-strong
              "
            >
              Sign in
            </button>
          </p>
        </div>
      </dialog>
    </div>
  );
}
