import { useAddProfile } from "../../hooks/useMe";
import type { AuthUser, ProfileKind } from "../../lib/auth";
import { PROFILE_KINDS, PROFILE_KIND_LABELS } from "../../lib/meApi";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";

type ProfilesSectionProps = {
  user: AuthUser;
  onUpdated: (user: AuthUser) => void;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "The Profile could not be added.";
}

export function ProfilesSection({ user, onUpdated }: ProfilesSectionProps) {
  const addProfile = useAddProfile(user.id);
  const held = new Set<ProfileKind>(user.profiles.map((profile) => profile.kind));

  return (
    <Card tone="white" hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">Profiles</h2>
      <p className="mt-2 text-sm text-slate">
        One account can act as more than one party. Adding a Profile does not change your account
        type.
      </p>

      <ul className="mt-4 space-y-3">
        {PROFILE_KINDS.map((kind) => (
          <li
            key={kind}
            className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-steel bg-paper p-3"
          >
            <span className="text-sm font-medium text-ink">
              {PROFILE_KIND_LABELS[kind]} profile
            </span>
            {held.has(kind) ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={addProfile.isPending}
                onClick={() => addProfile.mutate(kind, { onSuccess: (next) => onUpdated(next) })}
              >
                Add {PROFILE_KIND_LABELS[kind].toLowerCase()}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {addProfile.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(addProfile.error)}
        </p>
      )}
    </Card>
  );
}
