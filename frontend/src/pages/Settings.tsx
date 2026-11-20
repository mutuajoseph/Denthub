import { Download, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import { useDeleteAccount, useExportAccountData } from "../hooks/useAccount";
import { useMyVerifications, useSubmitVerification } from "../hooks/useVerification";
import type { AccountExportWire } from "../lib/accountApi";
import type { AuthUser } from "../lib/auth";
import type { VerificationSubjectKind } from "../lib/verificationApi";

type SettingsProps = {
  user: AuthUser | null;
  /** Called after the account is erased; the session is no longer valid. */
  onAccountDeleted: () => void;
};

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function downloadExport(data: AccountExportWire): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `denthub-account-${data.exported_at.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function eligibleSubjects(user: AuthUser): VerificationSubjectKind[] {
  const kinds: VerificationSubjectKind[] = [];
  if (user.profiles.some((profile) => profile.kind === "specialist")) kinds.push("specialist");
  if (user.memberships.some((membership) => membership.permissions.includes("owner"))) {
    kinds.push("facility");
  }
  if (user.profiles.some((profile) => profile.kind === "supplier")) kinds.push("supplier");
  if (user.profiles.some((profile) => profile.kind === "training_provider")) {
    kinds.push("training_provider");
  }
  return kinds;
}

const SUBJECT_LABELS: Record<VerificationSubjectKind, string> = {
  specialist: "Specialist",
  facility: "Facility",
  supplier: "Supplier",
  training_provider: "Training Provider",
};

function VerificationSection({ user }: { user: AuthUser }) {
  const kinds = eligibleSubjects(user);
  const [subjectKind, setSubjectKind] = useState<VerificationSubjectKind>(kinds[0] ?? "specialist");
  const [licence, setLicence] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [documentKeys, setDocumentKeys] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const status = useMyVerifications(user.id);
  const submit = useSubmitVerification();

  if (kinds.length === 0) {
    return null;
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitted(false);
    const keys = documentKeys
      .split(/[\n,]/)
      .map((key) => key.trim())
      .filter(Boolean);
    submit.mutate(
      {
        subject_kind: subjectKind,
        licence_number: licence.trim(),
        issuing_body: issuingBody.trim(),
        document_keys: keys,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          setLicence("");
          setIssuingBody("");
          setDocumentKeys("");
        },
        onError: (cause) => setError(describeError(cause, "Your application could not be sent.")),
      },
    );
  };

  const latest = status.data?.[0];

  return (
    <Card tone="white" hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Verification
      </h2>
      <p className="mt-1 text-sm text-charcoal">
        Apply to have your credentials checked. An approval verifies the public listing; a rejection
        or revocation carries a reason you can read here.
      </p>

      {status.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading your application…</output>
      ) : status.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {describeError(status.error, "Your application could not be loaded.")}
        </p>
      ) : latest ? (
        <div className="mt-3 rounded-button border border-steel bg-cloud px-4 py-3">
          <p className="text-sm font-semibold text-ink">
            {SUBJECT_LABELS[latest.subject_kind]} · {latest.status}
          </p>
          <p className="mt-1 text-xs text-slate">Licence {latest.licence_number}</p>
          {latest.rejection_reason && (
            <p className="mt-1 text-xs text-red-700">{latest.rejection_reason}</p>
          )}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <label htmlFor="verification-subject" className="text-xs font-medium text-slate">
          What should be verified
        </label>
        <select
          id="verification-subject"
          value={subjectKind}
          onChange={(event) => setSubjectKind(event.target.value as VerificationSubjectKind)}
          className="min-h-11 rounded-button border border-steel bg-paper px-3 text-sm text-ink"
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {SUBJECT_LABELS[kind]}
            </option>
          ))}
        </select>
        <label htmlFor="verification-licence" className="text-xs font-medium text-slate">
          Licence or registration number
        </label>
        <input
          id="verification-licence"
          type="text"
          required
          maxLength={100}
          value={licence}
          onChange={(event) => setLicence(event.target.value)}
          className="min-h-11 rounded-button border border-steel bg-paper px-3 text-sm text-ink"
        />
        <label htmlFor="verification-issuer" className="text-xs font-medium text-slate">
          Issuing body
        </label>
        <input
          id="verification-issuer"
          type="text"
          required
          maxLength={200}
          value={issuingBody}
          onChange={(event) => setIssuingBody(event.target.value)}
          className="min-h-11 rounded-button border border-steel bg-paper px-3 text-sm text-ink"
        />
        <label htmlFor="verification-documents" className="text-xs font-medium text-slate">
          Private document keys (comma or newline separated)
        </label>
        <textarea
          id="verification-documents"
          required
          rows={2}
          value={documentKeys}
          onChange={(event) => setDocumentKeys(event.target.value)}
          className="rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
        />
        <Button
          type="submit"
          disabled={
            submit.isPending || !licence.trim() || !issuingBody.trim() || !documentKeys.trim()
          }
        >
          {submit.isPending ? "Sending…" : "Submit application"}
        </Button>
        {submitted && <p className="text-sm text-ink">Your application was sent.</p>}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}

/**
 * The caller's data rights (#128): download a copy of their own data, or erase
 * the account immediately. Erasure keeps only the clinician-authored Health
 * Record entries the clinical retention window protects.
 */
export function Settings({ user, onAccountDeleted }: SettingsProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const exportData = useExportAccountData();
  const deleteAccount = useDeleteAccount();

  if (!user) {
    return null;
  }

  const handleExport = () => {
    setDownloaded(false);
    exportData.mutate(undefined, {
      onSuccess: (data) => {
        downloadExport(data);
        setDownloaded(true);
      },
    });
  };

  const handleDelete = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setConfirmingDelete(false);
        onAccountDeleted();
      },
    });
  };

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate">Manage your account data, {user.full_name}.</p>
      </header>

      <div className="grid gap-4">
        <VerificationSection user={user} />
        <Card tone="white" hover={false}>
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
            Your data
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate">
            Download a JSON copy of your account details, profiles and facility memberships, your
            health record, appointments, and the messages you have sent.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            icon={Download}
            onClick={handleExport}
            disabled={exportData.isPending}
          >
            {exportData.isPending ? "Preparing download…" : "Download my data"}
          </Button>
          {downloaded && (
            <output className="mt-3 block text-sm text-slate">
              Your data has been downloaded.
            </output>
          )}
          {exportData.error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {describeError(exportData.error, "Could not prepare your data. Please try again.")}
            </p>
          )}
        </Card>

        <Card tone="white" hover={false} className="border border-red-200">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-red-50 text-red-700">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                Danger zone
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate">
                Deleting your account erases your name, email, phone number, profiles and facility
                memberships now. Appointments stay linked to an anonymous record, and
                clinician-authored health entries are kept for the clinical retention period. This
                cannot be undone.
              </p>
              <Button
                className="mt-4"
                variant="danger"
                icon={Trash2}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete my account
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        ariaLabel="Delete your account"
        size="sm"
      >
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
          Delete your account?
        </h2>
        <p className="mt-3 text-sm text-slate">
          Your identity is erased immediately and you are signed out. Your data export stops being
          available. This cannot be undone.
        </p>
        {deleteAccount.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {describeError(deleteAccount.error, "Could not delete your account. Please try again.")}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleteAccount.isPending}
          >
            Keep my account
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleteAccount.isPending}>
            {deleteAccount.isPending ? "Deleting…" : "Yes, delete my account"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
