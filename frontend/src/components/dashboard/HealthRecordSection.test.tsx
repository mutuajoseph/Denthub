import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type HealthRecordEntryWire,
  type HealthRecordWire,
  addHealthRecordEntry,
  fetchHealthRecord,
  updateHealthRecord,
} from "../../lib/healthRecordApi";
import { HealthRecordSection } from "./HealthRecordSection";

vi.mock("../../lib/healthRecordApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/healthRecordApi")>();
  return {
    ...actual,
    fetchHealthRecord: vi.fn(),
    addHealthRecordEntry: vi.fn(),
    updateHealthRecord: vi.fn(),
  };
});

const fetchHealthRecordMock = vi.mocked(fetchHealthRecord);
const addHealthRecordEntryMock = vi.mocked(addHealthRecordEntry);
const updateHealthRecordMock = vi.mocked(updateHealthRecord);

function record(overrides: Partial<HealthRecordWire> = {}): HealthRecordWire {
  return {
    id: "hr-1",
    patient_id: "user-1",
    maternal_status: "none",
    entries: [],
    created_at: "2026-01-01T08:00:00",
    updated_at: "2026-01-01T08:00:00",
    ...overrides,
  };
}

function entry(overrides: Partial<HealthRecordEntryWire> = {}): HealthRecordEntryWire {
  return {
    id: "e-1",
    category: "allergy",
    body: "Penicillin — anaphylaxis.",
    author_id: "user-1",
    author_kind: "patient",
    author_name: "Amina Yusuf",
    created_at: "2026-01-01T09:00:00",
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <HealthRecordSection patientId="user-1" />
    </QueryClientProvider>,
  );
}

describe("HealthRecordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchHealthRecordMock.mockResolvedValue(record());
  });

  it("lists entries with an author badge and the maternal status", async () => {
    fetchHealthRecordMock.mockResolvedValue(
      record({
        maternal_status: "pregnant",
        entries: [
          entry(),
          entry({
            id: "e-2",
            category: "dental_history",
            body: "Composite on LL6.",
            author_id: "c-1",
            author_kind: "clinician",
            author_name: "Dr. Wanjiku Kamau",
            created_at: "2026-01-02T10:00:00",
          }),
        ],
      }),
    );

    renderSection();

    expect(await screen.findByText("Penicillin — anaphylaxis.")).toBeInTheDocument();
    // The category labels also appear as form options, so read them off the list.
    const list = within(screen.getByRole("list"));
    expect(list.getByText("Allergy")).toBeInTheDocument();
    expect(list.getByText("Dental history")).toBeInTheDocument();
    expect(list.getByText("Composite on LL6.")).toBeInTheDocument();
    expect(screen.getByText("Patient")).toBeInTheDocument();
    expect(screen.getByText("Clinician")).toBeInTheDocument();
    expect(screen.getByText("Dr. Wanjiku Kamau")).toBeInTheDocument();
    expect(screen.getByLabelText("Maternal status")).toHaveValue("pregnant");
    expect(screen.getByText("1 Jan 2026")).toBeInTheDocument();
  });

  it("appends an entry with the chosen category and body", async () => {
    const user = userEvent.setup();
    addHealthRecordEntryMock.mockResolvedValue(entry());

    renderSection();
    await screen.findByLabelText("Category");

    await user.selectOptions(screen.getByLabelText("Category"), "prescription");
    await user.type(screen.getByLabelText("Note"), "Amoxicillin 500mg TDS.");
    await user.click(screen.getByRole("button", { name: /add entry/i }));

    await waitFor(() =>
      expect(addHealthRecordEntryMock).toHaveBeenCalledWith("user-1", {
        category: "prescription",
        body: "Amoxicillin 500mg TDS.",
      }),
    );
  });

  it("updates the maternal status", async () => {
    const user = userEvent.setup();
    updateHealthRecordMock.mockResolvedValue(record({ maternal_status: "lactating" }));

    renderSection();
    await screen.findByLabelText("Maternal status");

    await user.selectOptions(screen.getByLabelText("Maternal status"), "lactating");

    await waitFor(() =>
      expect(updateHealthRecordMock).toHaveBeenCalledWith("user-1", {
        maternal_status: "lactating",
      }),
    );
  });

  it("surfaces a load failure with a retry", async () => {
    fetchHealthRecordMock.mockRejectedValue(new Error("offline"));

    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
