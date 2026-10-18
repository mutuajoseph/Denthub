import { type FormEvent, useState } from "react";
import {
  useAddHealthRecordEntry,
  useHealthRecord,
  useUpdateMaternalStatus,
} from "../../hooks/useHealthRecord";
import {
  HEALTH_RECORD_AUTHOR_LABELS,
  HEALTH_RECORD_CATEGORIES,
  HEALTH_RECORD_CATEGORY_LABELS,
  type HealthRecordEntryCategory,
  MATERNAL_STATUSES,
  MATERNAL_STATUS_LABELS,
  type MaternalStatus,
} from "../../lib/healthRecordApi";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** Entry timestamps are instants; render them in one fixed zone so they don't drift. */
function formatEntryDate(value: string): string {
  const instant = new Date(value.endsWith("Z") ? value : `${value}Z`);

  if (Number.isNaN(instant.getTime())) {
    return value;
  }

  return dateFormatter.format(instant);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Your health record could not be loaded.";
}

/**
 * The Patient's own Health Record: the record-level maternal status, the
 * append-only entries in reading order, and a form to add one. Each entry carries
 * an author badge — patient vs clinician — so a patient can see who wrote what.
 */
export function HealthRecordSection({ patientId }: { patientId: string }) {
  const { record, isLoading, error, refetch } = useHealthRecord(patientId);
  const addEntry = useAddHealthRecordEntry(patientId);
  const updateStatus = useUpdateMaternalStatus(patientId);

  const [category, setCategory] = useState<HealthRecordEntryCategory>("medical_history");
  const [body, setBody] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = body.trim();

    if (!trimmed) return;

    addEntry.mutate({ category, body: trimmed }, { onSuccess: () => setBody("") });
  };

  return (
    <section
      aria-labelledby="health-record-heading"
      className="rounded-card border border-steel bg-cloud p-5"
    >
      <h2 id="health-record-heading" className="font-heading text-lg font-semibold text-ink">
        Health record
      </h2>

      {isLoading ? (
        <output className="mt-3 block text-sm text-slate">Loading your health record…</output>
      ) : error ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-red-700">
            {describeError(error)}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 text-sm font-semibold text-ink underline"
          >
            Try again
          </button>
        </div>
      ) : record ? (
        <div className="mt-4 space-y-5">
          <div>
            <label htmlFor="maternal-status" className="block text-xs font-medium text-slate">
              Maternal status
            </label>
            <select
              id="maternal-status"
              className="mt-1 rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
              value={record.maternalStatus}
              onChange={(event) => updateStatus.mutate(event.target.value as MaternalStatus)}
              disabled={updateStatus.isPending}
            >
              {MATERNAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {MATERNAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            {updateStatus.isError && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {describeError(updateStatus.error)}
              </p>
            )}
          </div>

          {record.entries.length === 0 ? (
            <p className="text-sm text-charcoal">No entries yet.</p>
          ) : (
            <ul className="space-y-3">
              {record.entries.map((entry) => (
                <li key={entry.id} className="rounded-button border border-steel bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {HEALTH_RECORD_CATEGORY_LABELS[entry.category]}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.authorKind === "clinician" ? "ink" : "neutral"}>
                        {HEALTH_RECORD_AUTHOR_LABELS[entry.authorKind]}
                      </Badge>
                      <span className="text-xs text-slate">
                        {entry.authorName ?? "Unknown author"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-charcoal">{entry.body}</p>
                  <p className="mt-2 text-xs text-slate">{formatEntryDate(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-steel pt-4">
            <div>
              <label htmlFor="entry-category" className="block text-xs font-medium text-slate">
                Category
              </label>
              <select
                id="entry-category"
                className="mt-1 rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
                value={category}
                onChange={(event) => setCategory(event.target.value as HealthRecordEntryCategory)}
              >
                {HEALTH_RECORD_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {HEALTH_RECORD_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="entry-body" className="block text-xs font-medium text-slate">
                Note
              </label>
              <textarea
                id="entry-body"
                rows={3}
                maxLength={5000}
                className="mt-1 w-full rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
            {addEntry.isError && (
              <p role="alert" className="text-sm text-red-700">
                {describeError(addEntry.error)}
              </p>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={addEntry.isPending || body.trim().length === 0}
            >
              {addEntry.isPending ? "Adding…" : "Add entry"}
            </Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
