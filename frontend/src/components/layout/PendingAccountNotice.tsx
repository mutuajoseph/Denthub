import { CircleAlert } from "lucide-react";
import type { AuthUser } from "../../lib/auth";

export type PendingAccountNoticeProps = {
  user: AuthUser | null;
};

export function PendingAccountNotice({ user }: PendingAccountNoticeProps) {
  if (user?.account_status !== "pending") return null;

  return (
    <aside
      aria-label="Account awaiting approval"
      className="border-b border-graphite/10 bg-cloud px-4 py-3"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-2.5">
        <CircleAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-graphite"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <p className="text-sm leading-relaxed text-ink/80">
          Your professional account is awaiting staff approval. You can keep browsing while a staff
          member reviews your signup.
        </p>
      </div>
    </aside>
  );
}
