import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JOBS_PAGE_SIZE, JOB_EMPLOYMENT_TYPES } from "../config/jobConstants";
import {
  type CountryConfig,
  type SpecialtyWire,
  fetchCountryConfig,
  fetchSpecialties,
} from "../lib/countryConfigApi";
import { type JobPageWire, type JobPostingWire, fetchJobs } from "../lib/jobsApi";
import { useRegionStore } from "../store/regionStore";
import { JobsBoard } from "./JobsBoard";

vi.mock("../lib/jobsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/jobsApi")>();

  return {
    ...actual,
    fetchJobs: vi.fn(),
  };
});

vi.mock("../lib/countryConfigApi", () => ({
  fetchCountries: vi.fn(),
  fetchCountryConfig: vi.fn(),
  fetchSpecialties: vi.fn(),
}));

const fetchJobsMock = vi.mocked(fetchJobs);
const fetchCountryConfigMock = vi.mocked(fetchCountryConfig);
const fetchSpecialtiesMock = vi.mocked(fetchSpecialties);

function makeConfig(code: string): CountryConfig {
  const regions =
    code === "KE"
      ? [
          { id: "KE-NAIROBI", name: "Nairobi", code: "NAIROBI", countryCode: "KE" },
          { id: "KE-MOMBASA", name: "Mombasa", code: "MOMBASA", countryCode: "KE" },
        ]
      : [];
  return {
    code,
    name: code,
    currency: "KES",
    currencySymbol: "KSh",
    locale: "en-KE",
    geography: { subdivisionLabel: "County", subdivisionPlural: "Counties", cityLabel: "City" },
    features: {},
    featureConfigs: {},
    featureContexts: {},
    insuranceProviders: [],
    regions,
  };
}

function buildPosting(overrides: Partial<JobPostingWire> = {}): JobPostingWire {
  return {
    id: "job-1",
    title: "Dentist (BDS)",
    description: "Join the clinical team at a busy Nairobi practice.",
    requirements: "BDS with a valid KDC registration.",
    employment_type: "Full Time",
    seniority: "Mid Level",
    posted_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    specialty_codes: ["general-dentistry"],
    workplace: {
      facility_name: "Nairobi Dental Care Centre",
      branch_name: null,
      subdivision_code: "NAIROBI",
      address: "Westlands, Nairobi",
      phone: "+254711000000",
    },
    salary_range: {
      min_amount: "180000.00",
      max_amount: "250000.00",
      currency: "KES",
    },
    ...overrides,
  };
}

function jobsPage(overrides: Partial<JobPageWire> = {}): JobPageWire {
  return {
    items: [buildPosting()],
    total: 1,
    limit: 100,
    offset: 0,
    country_code: "KE",
    currency: "KES",
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <JobsBoard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("JobsBoard", () => {
  // The region store otherwise infers the country from `navigator.languages`,
  // which is `en-US` under jsdom, and every mocked posting is Kenyan.
  beforeEach(() => {
    fetchCountryConfigMock.mockImplementation(async (code) => makeConfig(code ?? "KE"));
    useRegionStore.getState().setRegion("KE");
    fetchSpecialtiesMock.mockResolvedValue([
      {
        id: "s1",
        code: "general-dentistry",
        name: "General Dentistry",
        description: null,
        display_order: 10,
      },
      {
        id: "s2",
        code: "orthodontics",
        name: "Orthodontics",
        description: null,
        display_order: 20,
      },
    ] satisfies SpecialtyWire[]);
    fetchJobsMock.mockResolvedValue(jobsPage());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the board heading from site content", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: /dental jobs board kenya/i }),
    ).toBeInTheDocument();
  });

  it("asks the API for the country's published board, sending filter inputs", async () => {
    renderPage();

    await screen.findByText("Dentist (BDS)");

    expect(fetchJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({ country: "KE", limit: 100 }),
      expect.anything(),
    );
  });

  it("caps the list at the page size and offers to show the rest", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 8 }, (_, index) =>
      buildPosting({
        id: `job-${index}`,
        title: `Role ${index + 1}`,
      }),
    );
    fetchJobsMock.mockResolvedValue(jobsPage({ items, total: items.length }));

    renderPage();

    const toggle = await screen.findByRole("button", { name: /show all 8 jobs/i });
    expect(toggle).toBeInTheDocument();

    // Only the first page is rendered before expanding.
    expect(screen.getAllByRole("article")).toHaveLength(JOBS_PAGE_SIZE);

    await user.click(toggle);
    expect(screen.getAllByRole("article")).toHaveLength(items.length);
    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });

  it("filters by employment type", async () => {
    const user = userEvent.setup();
    fetchJobsMock.mockResolvedValue(
      jobsPage({
        items: [
          buildPosting({ id: "full", title: "Full-time role", employment_type: "Full Time" }),
          buildPosting({ id: "part", title: "Part-time role", employment_type: "Part Time" }),
        ],
        total: 2,
      }),
    );

    renderPage();
    expect(await screen.findByText("Full-time role")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/employment type/i), "Part Time");

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByRole("heading", { name: /part-time role/i })).toBeInTheDocument();
  });

  it("sends the chosen subdivision and specialty to the API", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Dentist (BDS)");

    await user.selectOptions(screen.getByLabelText(/specialty/i), "orthodontics");
    await user.selectOptions(screen.getByLabelText(/county/i), "MOMBASA");

    await waitFor(() => {
      expect(fetchJobsMock).toHaveBeenCalledWith(
        expect.objectContaining({ specialtyCode: "orthodontics", subdivisionCode: "MOMBASA" }),
        expect.anything(),
      );
    });
  });

  it("offers a sensible empty state when filters exclude everything", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Dentist (BDS)");

    await user.selectOptions(screen.getByLabelText(/employment type/i), "Internship");
    expect(screen.getByText(/no jobs match those filters/i)).toBeInTheDocument();
  });

  it("explains an empty region separately from an empty filter result", async () => {
    useRegionStore.getState().setRegion("US");
    fetchJobsMock.mockResolvedValue(jobsPage({ items: [], total: 0 }));

    renderPage();

    expect(await screen.findByText(/no jobs listed in your region yet/i)).toBeInTheDocument();
  });

  it("labels the region filter for the active country", async () => {
    renderPage();

    // Kenya is the default region, so the subdivision filter reads "County".
    expect(await screen.findByLabelText(/county/i)).toBeInTheDocument();
  });

  it("renders a salary range in the posting's currency", async () => {
    renderPage();

    // The posting carries its own KES band; Intl renders it as "KSh" here.
    expect((await screen.findAllByRole("article"))[0]).toHaveTextContent(/Ksh\s?180,000/);
  });

  it("falls back to 'Competitive' when no range is disclosed", async () => {
    fetchJobsMock.mockResolvedValue(jobsPage({ items: [buildPosting({ salary_range: null })] }));

    renderPage();

    expect(await screen.findByText("Competitive")).toBeInTheDocument();
  });

  it("shows an error state with a retry when the board request fails", async () => {
    const user = userEvent.setup();
    fetchJobsMock.mockRejectedValueOnce(new Error("boom"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load the jobs board/i);

    fetchJobsMock.mockResolvedValue(jobsPage());
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Dentist (BDS)")).toBeInTheDocument();
  });

  it("exposes every employment type in the filter", async () => {
    renderPage();

    const select = await screen.findByLabelText(/employment type/i);
    for (const type of JOB_EMPLOYMENT_TYPES) {
      expect(within(select).getByRole("option", { name: type })).toBeInTheDocument();
    }
  });
});
