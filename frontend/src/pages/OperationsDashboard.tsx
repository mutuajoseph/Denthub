import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useDivisionJobs, useOperationsOverview, useSetJobStatus } from "../hooks/useOperations";
import type { AuthUser } from "../lib/auth";
import type {
  DivisionJobWire,
  JobStatus,
  OperatorDivision,
  OperatorTier,
} from "../lib/operationsApi";

type OperationsDashboardProps = {
  user: AuthUser | null;
};

const DIVISION_LABELS: Record<OperatorDivision, string> = {
  jobs: "Jobs",
  shop: "Shop",
  training: "Training",
  dentist: "Dentist",
  international: "International",
  suppliers: "Suppliers",
};

const TIER_LABELS: Record<OperatorTier, string> = {
  lead: "Lead",
  assistant: "Assistant",
};

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function SectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="mt-3">
      <p role="alert" className="text-sm text-red-700">
        {describeError(error, "This section could not be loaded.")}
      </p>
      <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** The one Job posting row, with the write control only when the tier allows it. */
function JobRow({
  job,
  canWrite,
  isSaving,
  onSetStatus,
}: {
  job: DivisionJobWire;
  canWrite: boolean;
  isSaving: boolean;
  onSetStatus: (status: JobStatus) => void;
}) {
  const nextStatus: JobStatus = job.status === "published" ? "hidden" : "published";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-steel bg-paper px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant={job.status === "published" ? "success" : "danger"}>{job.status}</Badge>
          <span className="text-xs text-slate">{job.country_code}</span>
        </div>
      </div>
      {canWrite && (
        <Button
          variant={job.status === "published" ? "secondary" : "graphite"}
          size="sm"
          disabled={isSaving}
          onClick={() => onSetStatus(nextStatus)}
        >
          {job.status === "published" ? "Hide" : "Publish"}
        </Button>
      )}
    </li>
  );
}

function JobsSection({ userId, canWrite }: { userId: string; canWrite: boolean }) {
  const query = useDivisionJobs(userId);
  const setStatus = useSetJobStatus();
  const jobs = query.data;

  return (
    <Card hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Job postings
      </h2>
      <p className="mt-1 text-sm text-charcoal">
        Hide a posting from every public read path, or publish it again.
        {!canWrite && " Your Assistant tier can review the queue but not change it."}
      </p>

      {query.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading job postings…</output>
      ) : query.error || !jobs ? (
        <SectionError error={query.error} onRetry={() => void query.refetch()} />
      ) : jobs.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">No Job postings are in this Division yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              canWrite={canWrite}
              isSaving={setStatus.isPending}
              onSetStatus={(status) => setStatus.mutate({ postingId: job.id, status })}
            />
          ))}
        </ul>
      )}

      {setStatus.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(setStatus.error, "The Job posting could not be updated.")}
        </p>
      )}
    </Card>
  );
}

/**
 * The operations console (#83): a Platform Operator's work inside their one
 * Division, at a Lead or Assistant tier. The route is role-gated to
 * `platform_operator`; the backend refuses every call without a staff token and
 * scopes each read to the Division on the account row, so this screen never
 * relies on hiding a link as the access check.
 */
export function OperationsDashboard({ user }: OperationsDashboardProps) {
  const overview = useOperationsOverview(user?.id ?? null);

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Operations
        </h1>
        <p className="mt-2 text-sm text-slate">Signed in as {user.full_name}.</p>
      </header>

      <div className="space-y-4">
        <Card hover={false}>
          {overview.isPending ? (
            <output className="block text-sm text-slate">Loading your Division…</output>
          ) : overview.error || !overview.data ? (
            <SectionError error={overview.error} onRetry={() => void overview.refetch()} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                  {DIVISION_LABELS[overview.data.division]} Division
                </h2>
                <Badge variant={overview.data.tier === "lead" ? "success" : "neutral"}>
                  {TIER_LABELS[overview.data.tier]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-charcoal">
                {overview.data.can_write
                  ? "Lead tier: you may publish and hide content in this Division."
                  : "Assistant tier: you can review this Division, but changes are Lead-only."}
              </p>
            </>
          )}
        </Card>

        {overview.data?.division === "jobs" ? (
          <JobsSection userId={user.id} canWrite={overview.data.can_write} />
        ) : overview.data ? (
          <Card hover={false}>
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
              {DIVISION_LABELS[overview.data.division]} workspace
            </h2>
            <p className="mt-1 text-sm text-charcoal">
              The {DIVISION_LABELS[overview.data.division]} Division tools arrive in a follow-up.
              Your Division and tier are already assigned.
            </p>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
