/**
 * The shared Verification application queue for the admin and operations
 * consoles. The caller owns permissions: Assistants and read-only views pass
 * `canWrite={false}`, so no decision control is rendered at all.
 */

import { useState } from "react";

import type {
  VerificationApplicationWire,
  VerificationDecision,
  VerificationStatus,
} from "../../lib/verificationApi";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

type VerificationQueueProps = {
  applications: VerificationApplicationWire[];
  canWrite: boolean;
  isSaving: boolean;
  onDecide: (applicationId: string, decision: VerificationDecision, reason: string | null) => void;
  emptyLabel: string;
};

const STATUS_VARIANT: Record<VerificationStatus, "success" | "danger" | "neutral"> = {
  pending: "neutral",
  verified: "success",
  rejected: "danger",
  revoked: "danger",
};

const SUBJECT_LABELS: Record<VerificationApplicationWire["subject_kind"], string> = {
  specialist: "Specialist",
  facility: "Facility",
  supplier: "Supplier",
  training_provider: "Training Provider",
};

export function VerificationQueue({
  applications,
  canWrite,
  isSaving,
  onDecide,
  emptyLabel,
}: VerificationQueueProps) {
  const [pending, setPending] = useState<{
    id: string;
    decision: VerificationDecision;
    reason: string;
  } | null>(null);

  if (applications.length === 0) {
    return <p className="mt-3 text-sm text-charcoal">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-4 space-y-2">
      {applications.map((application) => {
        const draft = pending?.id === application.id ? pending : null;
        return (
          <li
            key={application.id}
            className="rounded-button border border-steel bg-paper px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {SUBJECT_LABELS[application.subject_kind]} · {application.licence_number}
                </p>
                <p className="mt-0.5 text-xs text-slate">
                  {application.applicant_email} · {application.issuing_body}
                </p>
                <p className="mt-1 text-xs text-slate">
                  Documents: {application.document_keys.join(", ")}
                </p>
                {application.rejection_reason && (
                  <p className="mt-1 text-xs text-red-700">{application.rejection_reason}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[application.status]}>{application.status}</Badge>
            </div>

            {canWrite && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-steel pt-3">
                {application.status === "pending" && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isSaving}
                      aria-label={`Approve ${application.applicant_email}`}
                      onClick={() => onDecide(application.id, "approve", null)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isSaving}
                      aria-label={`Reject ${application.applicant_email}`}
                      onClick={() =>
                        setPending({ id: application.id, decision: "reject", reason: "" })
                      }
                    >
                      Reject
                    </Button>
                  </>
                )}
                {application.status === "verified" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isSaving}
                    aria-label={`Revoke ${application.applicant_email}`}
                    onClick={() =>
                      setPending({ id: application.id, decision: "revoke", reason: "" })
                    }
                  >
                    Revoke
                  </Button>
                )}
              </div>
            )}

            {draft && (
              <div className="mt-2">
                <label
                  htmlFor={`reason-${application.id}`}
                  className="block text-xs font-medium text-slate"
                >
                  Reason for {draft.decision}
                </label>
                <input
                  id={`reason-${application.id}`}
                  type="text"
                  maxLength={500}
                  value={draft.reason}
                  onChange={(event) => setPending({ ...draft, reason: event.target.value })}
                  className="mt-1 w-full rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isSaving || !draft.reason.trim()}
                    onClick={() => {
                      onDecide(application.id, draft.decision, draft.reason.trim());
                      setPending(null);
                    }}
                  >
                    Confirm {draft.decision}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
