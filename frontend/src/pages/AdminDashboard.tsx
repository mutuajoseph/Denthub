import { type FormEvent, useState } from "react";

import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  useAdminAudit,
  useAdminCountries,
  useAdminModeration,
  useAdminStaff,
  useAdminVerifications,
  useCreatePlatformStaff,
  useModerateContent,
  useSetVerificationTier,
  useUpdateCountry,
  useUpdateCountryFeature,
  useUpdatePlatformStaff,
} from "../hooks/useAdmin";
import type {
  AdminAuditEntryWire,
  ModerationItemWire,
  OperatorDivision,
  OperatorTier,
  PlatformStaffRole,
  VerificationTier,
} from "../lib/adminApi";
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
  staff: "Platform Staff",
};

const ACTION_LABELS: Record<string, string> = {
  "country.update": "Country updated",
  "country.feature.update": "Feature flag changed",
  "verification.set": "Verification tier set",
  "moderation.status": "Moderation status changed",
  "staff.create": "Platform Staff created",
  "staff.update": "Platform Staff updated",
};

const STAFF_ROLES: PlatformStaffRole[] = ["admin", "super_admin", "platform_operator"];

const STAFF_ROLE_LABELS: Record<PlatformStaffRole, string> = {
  admin: "Admin",
  super_admin: "Super Admin",
  platform_operator: "Operator",
};

const OPERATOR_DIVISIONS: OperatorDivision[] = [
  "jobs",
  "shop",
  "training",
  "dentist",
  "international",
  "suppliers",
];

const OPERATOR_TIERS: OperatorTier[] = ["lead", "assistant"];

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

function StaffSection({ userId }: { userId: string | null }) {
  const query = useAdminStaff(userId);
  const createStaff = useCreatePlatformStaff();
  const updateStaff = useUpdatePlatformStaff();
  const members = query.data;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PlatformStaffRole>("admin");
  const [division, setDivision] = useState<OperatorDivision>("jobs");
  const [tier, setTier] = useState<OperatorTier>("lead");
  const isOperator = role === "platform_operator";
  const [promotion, setPromotion] = useState<{
    id: string;
    division: OperatorDivision | "";
    tier: OperatorTier | "";
  } | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createStaff.mutate(
      {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        ...(isOperator
          ? { operator_division: division, operator_tier: tier }
          : { operator_division: null, operator_tier: null }),
      },
      {
        onSuccess: () => {
          setFullName("");
          setEmail("");
          setPassword("");
          setRole("admin");
          setDivision("jobs");
          setTier("lead");
        },
      },
    );
  };

  return (
    <Card hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Platform Staff
      </h2>
      <p className="mt-1 text-sm text-charcoal">
        Give a User a staff role. An Operator carries one Division and a tier; every other role
        carries neither. Changes apply on the member&apos;s next request.
      </p>

      {query.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading Platform Staff...</output>
      ) : query.error || !members ? (
        <SectionError error={query.error} onRetry={() => void query.refetch()} />
      ) : members.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">No Platform Staff yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {members.map((member) => (
            <li key={member.id} className="rounded-button border border-steel bg-paper px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{member.full_name}</p>
                  <p className="mt-0.5 text-xs text-slate">{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{STAFF_ROLE_LABELS[member.role]}</Badge>
                  <Badge variant={member.is_active ? "success" : "danger"}>
                    {member.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-steel pt-3">
                <div className="flex flex-col gap-1 text-xs font-medium text-charcoal">
                  <span>Role</span>
                  <select
                    aria-label={`Role for ${member.full_name}`}
                    value={member.role}
                    disabled={updateStaff.isPending}
                    onChange={(event) => {
                      const nextRole = event.target.value as PlatformStaffRole;
                      if (
                        nextRole === "platform_operator" &&
                        (member.operator_division === null || member.operator_tier === null)
                      ) {
                        setPromotion({ id: member.id, division: "", tier: "" });
                        return;
                      }
                      updateStaff.mutate({
                        staffId: member.id,
                        request: {
                          role: nextRole,
                          operator_division:
                            nextRole === "platform_operator" ? member.operator_division : null,
                          operator_tier:
                            nextRole === "platform_operator" ? member.operator_tier : null,
                        },
                      });
                    }}
                    className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
                  >
                    {STAFF_ROLES.map((option) => (
                      <option key={option} value={option}>
                        {STAFF_ROLE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>

                {promotion?.id === member.id && (
                  <>
                    <div className="flex flex-col gap-1 text-xs font-medium text-charcoal">
                      <span>Division</span>
                      <select
                        aria-label={`Division for ${member.full_name}`}
                        value={promotion.division}
                        disabled={updateStaff.isPending}
                        onChange={(event) =>
                          setPromotion({
                            ...promotion,
                            division: event.target.value as OperatorDivision | "",
                          })
                        }
                        className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
                      >
                        <option value="">Select Division</option>
                        {OPERATOR_DIVISIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 text-xs font-medium text-charcoal">
                      <span>Tier</span>
                      <select
                        aria-label={`Tier for ${member.full_name}`}
                        value={promotion.tier}
                        disabled={updateStaff.isPending}
                        onChange={(event) =>
                          setPromotion({
                            ...promotion,
                            tier: event.target.value as OperatorTier | "",
                          })
                        }
                        className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
                      >
                        <option value="">Select tier</option>
                        {OPERATOR_TIERS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      type="button"
                      variant="graphite"
                      size="sm"
                      aria-label={`Save ${member.full_name}`}
                      disabled={
                        updateStaff.isPending || promotion.division === "" || promotion.tier === ""
                      }
                      onClick={() => {
                        if (promotion.division === "" || promotion.tier === "") return;
                        updateStaff.mutate(
                          {
                            staffId: member.id,
                            request: {
                              role: "platform_operator",
                              operator_division: promotion.division,
                              operator_tier: promotion.tier,
                            },
                          },
                          { onSuccess: () => setPromotion(null) },
                        );
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label={`Cancel ${member.full_name}`}
                      onClick={() => setPromotion(null)}
                    >
                      Cancel
                    </Button>
                  </>
                )}

                {member.role === "platform_operator" && (
                  <>
                    <div className="flex flex-col gap-1 text-xs font-medium text-charcoal">
                      <span>Division</span>
                      <select
                        aria-label={`Division for ${member.full_name}`}
                        value={member.operator_division ?? "jobs"}
                        disabled={updateStaff.isPending}
                        onChange={(event) =>
                          updateStaff.mutate({
                            staffId: member.id,
                            request: {
                              operator_division: event.target.value as OperatorDivision,
                            },
                          })
                        }
                        className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
                      >
                        {OPERATOR_DIVISIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 text-xs font-medium text-charcoal">
                      <span>Tier</span>
                      <select
                        aria-label={`Tier for ${member.full_name}`}
                        value={member.operator_tier ?? "lead"}
                        disabled={updateStaff.isPending}
                        onChange={(event) =>
                          updateStaff.mutate({
                            staffId: member.id,
                            request: { operator_tier: event.target.value as OperatorTier },
                          })
                        }
                        className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
                      >
                        {OPERATOR_TIERS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <Button
                  variant={member.is_active ? "secondary" : "graphite"}
                  size="sm"
                  aria-label={
                    member.is_active
                      ? `Deactivate ${member.full_name}`
                      : `Reactivate ${member.full_name}`
                  }
                  disabled={updateStaff.isPending}
                  onClick={() =>
                    updateStaff.mutate({
                      staffId: member.id,
                      request: { is_active: !member.is_active },
                    })
                  }
                >
                  {member.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-6 grid gap-3 border-t border-steel pt-4 sm:grid-cols-2" onSubmit={submit}>
        <h3 className="font-display text-base font-semibold text-ink sm:col-span-2">
          Add a staff member
        </h3>

        <label className="flex flex-col gap-1 text-xs font-medium text-charcoal">
          Full name
          <input
            required
            maxLength={100}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-charcoal">
          Email
          <input
            required
            type="email"
            maxLength={255}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-charcoal">
          Password
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-charcoal">
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as PlatformStaffRole)}
            className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
          >
            {STAFF_ROLES.map((option) => (
              <option key={option} value={option}>
                {STAFF_ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        {isOperator && (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-charcoal">
              Division
              <select
                value={division}
                onChange={(event) => setDivision(event.target.value as OperatorDivision)}
                className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
              >
                {OPERATOR_DIVISIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-charcoal">
              Operator tier
              <select
                value={tier}
                onChange={(event) => setTier(event.target.value as OperatorTier)}
                className="min-h-9 rounded-button border border-steel bg-paper px-2 text-sm text-ink"
              >
                {OPERATOR_TIERS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="sm:col-span-2">
          <Button type="submit" variant="graphite" size="sm" disabled={createStaff.isPending}>
            Create staff member
          </Button>
        </div>
      </form>

      {createStaff.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(createStaff.error, "The staff member could not be created.")}
        </p>
      )}
      {updateStaff.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(updateStaff.error, "The staff member could not be updated.")}
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
        Newest staff write first. Every console change records who acted and what changed.
      </p>

      {query.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading the audit trail…</output>
      ) : query.error || !entries ? (
        <SectionError error={query.error} onRetry={() => void query.refetch()} />
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">No staff changes have been recorded yet.</p>
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
        {user.role === "super_admin" && <StaffSection userId={user.id} />}
        <AuditSection userId={user.id} />
      </div>
    </section>
  );
}
