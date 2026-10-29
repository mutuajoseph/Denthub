import {
  Award,
  BookOpen,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  MapPin,
  Package,
  Phone,
  Plane,
  Stethoscope,
  User,
} from "lucide-react";
import { useState } from "react";

import { useCountryConfig } from "../hooks/useCountryConfig";
import { useRegion } from "../hooks/useRegion";
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
    id: "specialist",
    role: ROLE.SPECIALIST,
    label: "Specialist",
    description: "Professional account for dental specialists",
    icon: Award,
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

const fieldShellClass =
  "flex min-h-[44px] items-center gap-2 rounded-button border border-steel bg-cloud px-3 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10";
const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-slate";
const labelClass = "text-xs font-medium text-charcoal";

export default function Register({ onClose, onSignIn, onRegisterSuccess }: RegisterProps) {
  const { brandName, countryName } = useRegion();
  const { regions, subdivisionLabel } = useCountryConfig();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountTypeId | "">("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [subdivisionCode, setSubdivisionCode] = useState("");
  const [address, setAddress] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedAccount = ACCOUNT_TYPES.find((account) => account.id === accountType);
  const isFacility = selectedAccount?.role === ROLE.FACILITY_OWNER;

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
        account_type: selectedAccount.role,
        ...(isFacility
          ? {
              facility: {
                name: facilityName.trim(),
                subdivision_code: subdivisionCode,
                address: address.trim(),
              },
            }
          : {}),
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
    <div className="w-full">
      {/* =========================
          STEP 1 - ACCOUNT TYPE
      ========================== */}
      {step === 1 && (
        <>
          <div className="mb-5 text-center">
            <h2 className="font-heading text-[20px] font-semibold text-ink">Join {brandName}</h2>

            <p className="mt-1 text-[13px] text-slate">Choose how you'll use DentHub</p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {ACCOUNT_TYPES.map((account) => {
              const Icon = account.icon;

              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => selectAccount(account.id)}
                  className="group flex items-start gap-3 rounded-button border border-steel bg-cloud p-3 text-left transition hover:border-ink hover:bg-paper"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-paper text-charcoal shadow-card-white transition group-hover:bg-cloud">
                    <Icon className="h-4 w-4" strokeWidth={1.7} />
                  </div>

                  <div>
                    <h3 className="text-[13px] font-semibold text-ink">{account.label}</h3>

                    <p className="mt-0.5 text-[11px] leading-4 text-slate">{account.description}</p>
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
            <h2 className="font-heading text-[20px] font-semibold text-ink">Create your account</h2>

            <p className="mt-1 text-[13px] text-slate">
              {selectedAccount?.label} · {countryName}
            </p>
          </div>

          <form className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
            {/* Full Name */}
            <label htmlFor="full-name" className={labelClass}>
              Full name
            </label>

            <div className={fieldShellClass}>
              <User className="h-4 w-4 text-slate" />

              <input
                id="full-name"
                name="full_name"
                type="text"
                placeholder="Jane Doe"
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={inputClass}
              />
            </div>

            {/* Email */}
            <label htmlFor="email" className={`${labelClass} mt-1.5`}>
              Email
            </label>

            <div className={fieldShellClass}>
              <Mail className="h-4 w-4 text-slate" />

              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </div>

            {/* Phone */}
            <label htmlFor="phone" className={`${labelClass} mt-1.5`}>
              Phone <span className="font-normal text-slate">(optional)</span>
            </label>

            <div className={fieldShellClass}>
              <Phone className="h-4 w-4 text-slate" />

              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+254 712 345 678"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
              />
            </div>

            {isFacility && (
              <>
                {/* Facility */}
                <label htmlFor="facility-name" className={`${labelClass} mt-1.5`}>
                  Clinic name
                </label>

                <div className={fieldShellClass}>
                  <Building2 className="h-4 w-4 text-slate" />

                  <input
                    id="facility-name"
                    name="facility_name"
                    type="text"
                    placeholder="Smile Line Dental"
                    required
                    maxLength={150}
                    autoComplete="organization"
                    value={facilityName}
                    onChange={(event) => setFacilityName(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <label htmlFor="facility-subdivision" className={`${labelClass} mt-1.5`}>
                  {subdivisionLabel}
                </label>

                <div className={fieldShellClass}>
                  <MapPin className="h-4 w-4 text-slate" />

                  <select
                    id="facility-subdivision"
                    name="subdivision_code"
                    required
                    value={subdivisionCode}
                    onChange={(event) => setSubdivisionCode(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose a {subdivisionLabel.toLowerCase()}</option>
                    {regions.map((region) => (
                      <option key={region.code} value={region.code}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label htmlFor="facility-address" className={`${labelClass} mt-1.5`}>
                  Clinic address
                </label>

                <div className={fieldShellClass}>
                  <MapPin className="h-4 w-4 text-slate" />

                  <input
                    id="facility-address"
                    name="address"
                    type="text"
                    placeholder="Street, building, town"
                    required
                    maxLength={255}
                    autoComplete="street-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {/* Password */}
            <label htmlFor="password" className={`${labelClass} mt-1.5`}>
              Password
            </label>

            <div className={fieldShellClass}>
              <Lock className="h-4 w-4 text-slate" />

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
                className={inputClass}
              />

              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border-0 bg-ink p-0 text-paper transition hover:bg-graphite"
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
                className="mt-2 rounded-button border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700"
              >
                {error}
              </div>
            )}

            {/* Create Account */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 min-h-[44px] w-full rounded-button border-0 bg-aqua-relay px-4 text-sm font-semibold text-ink transition hover:bg-aqua-relay-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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
              className="mx-auto mt-1 border-0 bg-transparent p-0 text-[12px] font-medium text-charcoal transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Change account type
            </button>
          </form>
        </>
      )}

      {/* Sign In */}
      <p className="mt-4 text-center text-[12px] text-slate">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSignIn}
          className="border-0 bg-transparent p-0 font-semibold text-ink transition hover:text-charcoal"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
