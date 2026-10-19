import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  useAdminAudit,
  useAdminCountries,
  useAdminModeration,
  useAdminVerifications,
  useModerateContent,
  useSetVerificationTier,
  useUpdateCountry,
  useUpdateCountryFeature,
} from "../hooks/useAdmin";
import type { AdminAuditEntryWire, ModerationItemWire, VerificationTier } from "../lib/adminApi";
import type { AuthUser } from "../lib/auth";

type AdminDashboardProps = {
  user: AuthUser | null;
};

const FEATURE_LABELS: Record<string, string> = {
  DENTAL_INSURANCE: "Dental insurance",
  ORAL_CARE_SHOP: "Oral care shop",
  JOBS_BOARD: "Jobs board",
  CPD_TRAINING: "CPD training",
};

const ENTITY_LABELS: Record<string, string> = {
  facility: "Facility",
  specialist: "Specialist",
  magazine: "Magazine item",
  job: "Job posting",
};

const ACTION_LABELS: Record<string, string> = {
  "country.update": "Country updated",
  "country.feature.update": "Feature flag changed",
  "verification.set": "Verification tier set",
  "moderation.status": "Moderation status changed",
};

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function describeChange(entry: AdminAuditEntryWire): string {
  const after = entry.after ?? {};
  const parts = Object.entries(after).map(([key, value]) => `${key}: ${formatValue(value)}`);

  return parts.length > 0 ? parts.join(", ") : "—";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

function CountriesSection({ userId }: { userId: string | null }) {
  const query = useAdminCountries(userId);
  const updateCountry = useUpdateCountry();
  const updateFeature = useUpdateCountryFeature();
  const countries = query.data;

  return (
    <Card hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Countries and feature flags
      </h2>
      <p className="mt-1 text-sm text-charcoal">
        Retiring a market removes it from the public switcher. A flag switched off here is a
        deliberate market decision, not an unconfigured module.
      </p>

      {query.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading countries…</output>
      ) : query.error || !countries ? (
        <SectionError error={query.error} onRetry={() => void query.refetch()} />
      ) : countries.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">No countries are configured.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {countries.map((country) => (
            <li key={country.code} className="rounded-button border border-steel bg-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{country.name}</p>
                    <Badge variant="neutral">{country.code}</Badge>
                    <Badge variant={country.is_active ? "success" : "danger"}>
                      {country.is_active ? "Active" : "Retired"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate">
                    {country.currency} ({country.currency_symbol})
                  </p>
                </div>
                <Button
                  variant={country.is_active ? "secondary" : "graphite"}
                  size="sm"
                  disabled={updateCountry.isPending}
                  onClick={() =>
                    updateCountry.mutate({ code: country.code, isActive: !country.is_active })
                  }
                >
                  {country.is_active ? "Retire market" : "Restore market"}
                </Button>
              </div>

              {country.features.length === 0 ? (
                <p className="mt-3 text-sm text-charcoal">No features are configured.</p>
              ) : (
                <ul className="mt-3 space-y-2 border-t border-steel pt-3">
                  {country.features.map((feature) => (
                    <li
                      key={feature.feature}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {FEATURE_LABELS[feature.feature] ?? feature.feature}
                        </p>
                        {feature.primary_scheme && (
                          <p className="text-xs text-slate">Scheme: {feature.primary_scheme}</p>
                        )}
                      </div>
                      <Button
                        variant={feature.is_enabled ? "secondary" : "graphite"}
                        size="sm"
                        aria-pressed={feature.is_enabled}
                        disabled={updateFeature.isPending}
                        onClick={() =>
                          updateFeature.mutate({
                            code: country.code,
                            feature: feature.feature,
                            isEnabled: !feature.is_enabled,
                            primaryScheme: feature.primary_scheme,
                          })
                        }
                      >
                        {feature.is_enabled ? "Enabled" : "Disabled"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {updateCountry.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(updateCountry.error, "The country could not be updated.")}
        </p>
      )}
      {updateFeature.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(updateFeature.error, "The feature flag could not be updated.")}
        </p>
      )}
    </Card>
  );
}

function VerificationSection({ userId }: { userId: string | null }) {
  const query = useAdminVerifications(userId);
  const setTier = useSetVerificationTier();
  const data = query.data;

  return (
    <Card hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Verification tiers
      </h2>
      <p className="mt-1 text-sm text-charcoal">
        One graded value per Facility or Specialist. The public listing reads this value directly.
      </p>

      {query.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading profiles…</output>
      ) : query.error || !data ? (
        <SectionError error={query.error} onRetry={() => void query.refetch()} />
      ) : data.items.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">No Facilities or Specialists are listed yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.items.map((item) => (
            <li
              key={`${item.entity_type}:${item.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-steel bg-paper px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-0.5 text-xs text-slate">
                  {ENTITY_LABELS[item.entity_type] ?? item.entity_type} · {item.country_code}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-charcoal">
                Tier
                <select
                  value={item.verification_tier}
                  disabled={setTier.isPending}
                  onChange={(event) =>
                    setTier.mutate({
                      entityType: item.entity_type,
                      entityId: item.id,
                      tier: event.target.value as VerificationTier,
                    })
                  }
                  className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
                >
                  {data.tiers.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}

      {setTier.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(setTier.error, "The verification tier could not be updated.")}
        </p>
      )}
    </Card>
  );
}

function ModerationSection({ userId }: { userId: string | null }) {
  const query = useAdminModeration(userId);
  const moderate = useModerateContent();
  const items = query.data;

  const nextStatus = (item: ModerationItemWire) =>
    item.status === "published" ? "hidden" : "published";

  return (
    <Card hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">Moderation</h2>
      <p className="mt-1 text-sm text-charcoal">
        Hide a Magazine Item or Job posting from every public read path, or publish it again.
      </p>

      {query.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading the moderation queue…</output>
      ) : query.error || !items ? (
        <SectionError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">Nothing is waiting for moderation.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={`${item.entity_type}:${item.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-steel bg-paper px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">
                    {ENTITY_LABELS[item.entity_type] ?? item.entity_type}
                  </Badge>
                  <Badge variant={item.status === "published" ? "success" : "danger"}>
                    {item.status}
                  </Badge>
                  <span className="text-xs text-slate">{item.country_code}</span>
                </div>
              </div>
              <Button
                variant={item.status === "published" ? "secondary" : "graphite"}
                size="sm"
                disabled={moderate.isPending}
                onClick={() =>
                  moderate.mutate({
                    entityType: item.entity_type,
                    entityId: item.id,
                    status: nextStatus(item),
                  })
                }
              >
                {item.status === "published" ? "Hide" : "Publish"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {moderate.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(moderate.error, "The moderation status could not be changed.")}
        </p>
      )}
    </Card>
  );
}

function AuditSection({ userId }: { userId: string | null }) {
  const query = useAdminAudit(userId);
  const entries = query.data;

  return (
    <Card hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Audit trail
      </h2>
      <p className="mt-1 text-sm text-charcoal">
        Newest admin write first. Every console change records who acted and what changed.
      </p>

      {query.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading the audit trail…</output>
      ) : query.error || !entries ? (
        <SectionError error={query.error} onRetry={() => void query.refetch()} />
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">No admin changes have been recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-button border border-steel bg-paper px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                <time className="text-xs text-slate" dateTime={entry.created_at}>
                  {formatTimestamp(entry.created_at)}
                </time>
              </div>
              <p className="mt-1 text-xs text-slate">
                {entry.actor_email} ({entry.actor_role}) · {entry.entity_type}:{entry.entity_id}
              </p>
              <p className="mt-1 break-words text-sm text-charcoal">{describeChange(entry)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The staff admin console (#82): markets and their module flags, the graded
 * verification tier on each Facility and Specialist, the content moderation
 * queue, and the audit trail those writes produce. The route is role-gated to
 * `admin` and `super_admin`; the backend refuses every call without a staff
 * token, so this screen never relies on hiding a link as the access check.
 */
export function AdminDashboard({ user }: AdminDashboardProps) {
  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Administration
        </h1>
        <p className="mt-2 text-sm text-slate">Signed in as {user.full_name}.</p>
      </header>

      <div className="space-y-4">
        <CountriesSection userId={user.id} />
        <VerificationSection userId={user.id} />
        <ModerationSection userId={user.id} />
        <AuditSection userId={user.id} />
      </div>
    </section>
  );
}
