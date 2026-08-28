import { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ArrowRight,
} from "lucide-react";

type SignInProps = {
  onRegister: () => void;
  onForgotPassword: () => void;
  onPhoneLogin: () => void;
};

export function SignIn({
  onRegister,
  onForgotPassword,
  onPhoneLogin,
}: SignInProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full">
      {/* Welcome */}
      <p className="mb-4 mt-1 text-center text-[13px] text-[#98a5b8]">
        Welcome back to DentHub Kenya
      </p>

      <form className="flex flex-col gap-1.5">
        {/* Email */}
        <label
          htmlFor="auth-email"
          className="text-[12px] text-[#91a0b6]"
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
            transition
            focus-within:border-[#f47813]
            focus-within:ring-2
            focus-within:ring-[#f47813]/10
          "
        >
          <Mail
            className="h-4 w-4 shrink-0 text-[#a6b1c1]"
            strokeWidth={1.7}
          />

          <input
            id="auth-email"
            name="email"
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

        {/* Password */}
        <label
          htmlFor="auth-password"
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
            transition
            focus-within:border-[#f47813]
            focus-within:ring-2
            focus-within:ring-[#f47813]/10
          "
        >
          <Lock
            className="h-4 w-4 shrink-0 text-[#a6b1c1]"
            strokeWidth={1.7}
          />

          <input
            id="auth-password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
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
              showPassword ? "Hide password" : "Show password"
            }
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
              bg-[#b8c3d2]
              text-white
              transition
              hover:bg-[#a8b4c5]
            "
          >
            {showPassword ? (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.8} />
            ) : (
              <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
            )}
          </button>
        </div>

        {/* Sign In */}
        <button
          type="submit"
          className="
            mt-2
            flex
            min-h-[42px]
            w-full
            items-center
            justify-center
            gap-1.5
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
          Sign in
          <ArrowRight
            className="h-4 w-4"
            strokeWidth={1.8}
          />
        </button>

        {/* Google */}
        <button
          type="button"
          className="
            flex
            min-h-[42px]
            w-full
            items-center
            justify-center
            gap-2
            rounded-[8px]
            border-2
            border-[#ff851b]
            bg-white
            px-4
            text-[13px]
            font-semibold
            text-[#ff851b]
            transition
            hover:bg-orange-50
          "
        >
          <span className="text-[15px] font-bold">G</span>
          Sign in with Google
        </button>

        {/* Phone */}
        <button
          type="button"
          onClick={onPhoneLogin}
          className="
            mx-auto
            mt-1.5
            inline-flex
            items-center
            justify-center
            gap-1.5
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
          <Phone
            className="h-4 w-4"
            strokeWidth={1.8}
          />

          Continue with Phone Number
        </button>
      </form>

      {/* Forgot Password */}
      <button
        type="button"
        onClick={onForgotPassword}
        className="
          mx-auto
          mt-4
          block
          border-0
          bg-transparent
          p-0
          text-[13px]
          font-medium
          text-[#ff851b]
          transition
          hover:text-[#f47813]
        "
      >
        Forgot password?
      </button>

      {/* Register */}
      <p className="mt-2 text-center text-[12px] text-[#98a5b8]">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onRegister}
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
          Register
        </button>
      </p>
    </div>
  );
}
