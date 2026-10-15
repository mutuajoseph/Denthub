import Card from "../components/ui/Card";
import type { AuthUser } from "../lib/auth";

type DashboardProps = {
  user: AuthUser | null;
};

function roleLabel(role: AuthUser["role"]): string {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * The account shell every signed-in public account lands on. It carries the
 * user's identity today; the later #67 tickets (appointments, messaging, …) add
 * their own sections here.
 */
export function Dashboard({ user }: DashboardProps) {
  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Your account
        </h1>
        <p className="mt-2 text-sm text-slate">Signed in as {user.full_name}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card tone="white" hover={false} className="sm:col-span-2">
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
            Account details
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate">Name</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{user.full_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate">Email</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate">Account type</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{roleLabel(user.role)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate">Status</dt>
              <dd className="mt-1 text-sm font-medium capitalize text-ink">
                {user.account_status}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </section>
  );
}
