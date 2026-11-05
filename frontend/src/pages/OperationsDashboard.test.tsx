import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../lib/auth";
import type { DivisionJobWire, OperationsOverviewWire } from "../lib/operationsApi";
import {
  fetchDivisionJobs,
  fetchOperationsOverview,
  setDivisionJobStatus,
} from "../lib/operationsApi";
import { OperationsDashboard } from "./OperationsDashboard";

vi.mock("../lib/operationsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/operationsApi")>();
  return {
    ...actual,
    fetchOperationsOverview: vi.fn(),
    fetchDivisionJobs: vi.fn(),
    setDivisionJobStatus: vi.fn(),
  };
});

const fetchOverviewMock = vi.mocked(fetchOperationsOverview);
const fetchJobsMock = vi.mocked(fetchDivisionJobs);
const setJobStatusMock = vi.mocked(setDivisionJobStatus);

const operator: AuthUser = {
  id: "user-ops",
  email: "operator@example.com",
  full_name: "Nia Operator",
  role: "platform_operator",
  is_staff: true,
  account_status: "active",
  email_verified: true,
  profiles: [],
  memberships: [],
};

function overview(overrides: Partial<OperationsOverviewWire> = {}): OperationsOverviewWire {
  return { division: "jobs", tier: "lead", can_write: true, ...overrides };
}

function job(overrides: Partial<DivisionJobWire> = {}): DivisionJobWire {
  return {
    id: "job-1",
    title: "Associate dentist, Mombasa",
    status: "published",
    country_code: "KE",
    posted_at: "2030-01-01T10:00:00Z",
    ...overrides,
  };
}

function renderOperations(user: AuthUser | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OperationsDashboard user={user} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OperationsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOverviewMock.mockResolvedValue(overview());
    fetchJobsMock.mockResolvedValue({ items: [job()] });
    setJobStatusMock.mockResolvedValue(job({ status: "hidden" }));
  });

  it("renders nothing without a user", () => {
    const { container } = renderOperations(null);

    expect(container).toBeEmptyDOMElement();
    expect(fetchOverviewMock).not.toHaveBeenCalled();
  });

  it("shows the operator's Division, tier and job queue", async () => {
    renderOperations(operator);

    expect(await screen.findByRole("heading", { name: "Operations" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Jobs Division" })).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(await screen.findByText("Associate dentist, Mombasa")).toBeInTheDocument();
  });

  it("lets a Lead hide a published posting", async () => {
    renderOperations(operator);

    await userEvent.click(await screen.findByRole("button", { name: "Hide" }));

    expect(setJobStatusMock).toHaveBeenCalledWith("job-1", "hidden");
  });

  it("keeps an Assistant read-only", async () => {
    fetchOverviewMock.mockResolvedValue(overview({ tier: "assistant", can_write: false }));

    renderOperations(operator);

    expect(await screen.findByText(/changes are Lead-only/)).toBeInTheDocument();
    expect(await screen.findByText("Associate dentist, Mombasa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("names the follow-up for a Division without tools in this slice", async () => {
    fetchOverviewMock.mockResolvedValue(overview({ division: "shop" }));

    renderOperations(operator);

    expect(await screen.findByRole("heading", { name: "Shop workspace" })).toBeInTheDocument();
    expect(fetchJobsMock).not.toHaveBeenCalled();
  });

  it("surfaces a load failure with a retry", async () => {
    fetchOverviewMock.mockRejectedValue(new Error("offline"));

    renderOperations(operator);

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
