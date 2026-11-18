import { isPatientRole } from "../auth/roles";
import { AccountDetailsSection } from "../components/dashboard/AccountDetailsSection";
import { AppointmentsSection } from "../components/dashboard/AppointmentsSection";
import { HealthRecordSection } from "../components/dashboard/HealthRecordSection";
import { ProfilesSection } from "../components/dashboard/ProfilesSection";
import { SpecialistListingSection } from "../components/dashboard/SpecialistListingSection";
import { useMe } from "../hooks/useMe";
import type { AuthUser } from "../lib/auth";

type DashboardProps = {
  user: AuthUser | null;
  onUserUpdated: (user: AuthUser) => void;
};

/**
 * The account shell every signed-in public account lands on. It carries the
 * user's identity today; the later #67 tickets (appointments, messaging, …) add
 * their own sections here.
 */
export function Dashboard({ user, onUserUpdated }: DashboardProps) {
  const me = useMe(user?.id ?? null);

  if (!user) {
    return null;
  }

  const currentUser = me.data ?? user;
  const isSpecialist = currentUser.profiles.some((profile) => profile.kind === "specialist");

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Your account
        </h1>
        <p className="mt-2 text-sm text-slate">
          Signed in as <span>{currentUser.full_name}</span>
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <AccountDetailsSection user={currentUser} onUpdated={onUserUpdated} />
        </div>

        <div className="sm:col-span-2">
          <ProfilesSection user={currentUser} onUpdated={onUserUpdated} />
        </div>

        {isSpecialist && (
          <div className="sm:col-span-2">
            <SpecialistListingSection user={currentUser} />
          </div>
        )}

        {isPatientRole(user) && (
          <div className="sm:col-span-2">
            <AppointmentsSection userId={user.id} />
          </div>
        )}

        {isPatientRole(user) && (
          <div className="sm:col-span-2">
            <HealthRecordSection patientId={user.id} />
          </div>
        )}
      </div>
    </section>
  );
}
