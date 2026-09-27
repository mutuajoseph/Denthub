import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../utils/cn";

interface CardProps extends ComponentProps<"div"> {
  children: ReactNode;
  hover?: boolean;
}

export default function Card({ children, className, hover = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 text-[#172b4d] dark:border-navy-600 dark:bg-navy-800 dark:text-white",
        hover && "card-hover",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
