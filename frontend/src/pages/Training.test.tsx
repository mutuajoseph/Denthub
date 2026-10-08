import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type TrainingCoursePageWire,
  type TrainingCourseWire,
  type TrainingWebinarPageWire,
  type TrainingWebinarWire,
  fetchTrainingCourses,
  fetchTrainingWebinars,
} from "../lib/trainingApi";
import { useRegionStore } from "../store/regionStore";
import { Training } from "./Training";

vi.mock("../lib/trainingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/trainingApi")>();

  return {
    ...actual,
    fetchTrainingCourses: vi.fn(),
    fetchTrainingWebinars: vi.fn(),
  };
});

const fetchCoursesMock = vi.mocked(fetchTrainingCourses);
const fetchWebinarsMock = vi.mocked(fetchTrainingWebinars);

const HOUR_MS = 3_600_000;

function buildCourse(overrides: Partial<TrainingCourseWire> = {}): TrainingCourseWire {
  return {
    id: "course-1",
    title: "Restorative Dentistry Essentials",
    description: "A hands-on review of direct and indirect restorations.",
    provider: { name: "Nairobi Dental Academy", is_verified: true },
    subdivision_code: "NAIROBI",
    delivery_mode: "in_person",
    price: "12500.00",
    currency: "KES",
    ...overrides,
  };
}

function coursePage(overrides: Partial<TrainingCoursePageWire> = {}): TrainingCoursePageWire {
  return {
    items: [buildCourse()],
    total: 1,
    limit: 100,
    offset: 0,
    country_code: "KE",
    currency: "KES",
    ...overrides,
  };
}

function buildWebinar(overrides: Partial<TrainingWebinarWire> = {}): TrainingWebinarWire {
  return {
    id: "webinar-1",
    title: "Airway Management in Implant Dentistry",
    description: "A live walkthrough of airway-safe implant workflows.",
    provider: { name: "Nairobi Dental Academy", is_verified: true },
    join_url: "https://forms.example.com/join",
    scheduled_start: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    ...overrides,
  };
}

function webinarPage(overrides: Partial<TrainingWebinarPageWire> = {}): TrainingWebinarPageWire {
  return {
    items: [buildWebinar()],
    total: 1,
    limit: 100,
    offset: 0,
    country_code: "KE",
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Training />
    </QueryClientProvider>,
  );
}

function pending<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

describe("Training", () => {
  // The region store otherwise infers the country from `navigator.languages`,
  // which is `en-US` under jsdom, and every mocked catalogue is Kenyan.
  beforeEach(() => {
    useRegionStore.setState({ regionCode: "KE", hasManualSelection: true });
    fetchCoursesMock.mockResolvedValue(coursePage());
    fetchWebinarsMock.mockResolvedValue(webinarPage());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the training heading from site content", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: /skills & cpd training/i }),
    ).toBeInTheDocument();
  });

  it("asks the API for the country's catalogue, webinars upcoming first", async () => {
    renderPage();
    await screen.findByText("Restorative Dentistry Essentials");

    expect(fetchCoursesMock).toHaveBeenCalledWith(
      expect.objectContaining({ country: "KE", limit: 100 }),
      expect.anything(),
    );
    expect(fetchWebinarsMock).toHaveBeenCalledWith(
      expect.objectContaining({ country: "KE", limit: 100, upcoming: "upcoming" }),
      expect.anything(),
    );
  });

  it("lists every course and webinar the API returns", async () => {
    renderPage();

    expect(await screen.findByText("Restorative Dentistry Essentials")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);

    const webinars = screen
      .getByRole("heading", { name: /upcoming live webinars/i })
      .closest("section");
    expect(within(webinars as HTMLElement).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/airway management in implant dentistry/i)).toBeInTheDocument();
  });

  it("filters courses by delivery format over the API", async () => {
    const user = userEvent.setup();
    fetchCoursesMock.mockImplementation(async ({ deliveryMode }) =>
      coursePage({
        items:
          deliveryMode === "online"
            ? [buildCourse({ id: "online", title: "Remote course", delivery_mode: "online" })]
            : [
                buildCourse({
                  id: "in-person",
                  title: "Hands-on course",
                  delivery_mode: "in_person",
                }),
                buildCourse({ id: "online", title: "Remote course", delivery_mode: "online" }),
              ],
        total: 2,
      }),
    );

    renderPage();
    expect(await screen.findByText("Hands-on course")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Online" }));

    await waitFor(() => {
      expect(fetchCoursesMock).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryMode: "online" }),
        expect.anything(),
      );
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /remote course/i })).toBeInTheDocument();
  });

  it("toggles the webinar list to the archive", async () => {
    const user = userEvent.setup();
    fetchWebinarsMock.mockResolvedValue(
      webinarPage({
        items: [buildWebinar({ scheduled_start: new Date(Date.now() - HOUR_MS).toISOString() })],
      }),
    );

    renderPage();
    await screen.findByText(/airway management in implant dentistry/i);

    const archive = screen.getByRole("button", { name: "Archive" });
    await user.click(archive);
    expect(archive).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(fetchWebinarsMock).toHaveBeenCalledWith(
        expect.objectContaining({ upcoming: "past" }),
        expect.anything(),
      );
    });
  });

  it("shows a loading state while both lists are in flight", () => {
    fetchCoursesMock.mockReturnValue(pending());
    fetchWebinarsMock.mockReturnValue(pending());

    renderPage();

    expect(screen.getByText("Loading courses…")).toBeInTheDocument();
    expect(screen.getByText("Loading webinars…")).toBeInTheDocument();
  });

  it("offers a retry when the catalogue request fails, restoring both lists", async () => {
    const user = userEvent.setup();
    fetchCoursesMock.mockRejectedValueOnce(new Error("boom"));
    fetchWebinarsMock.mockRejectedValueOnce(new Error("boom"));

    renderPage();

    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent(/could not load the training catalogue/i);

    const retryButtons = screen.getAllByRole("button", { name: /try again/i });
    await user.click(retryButtons[0]);
    await user.click(retryButtons[1]);

    expect(await screen.findByText("Restorative Dentistry Essentials")).toBeInTheDocument();
  });

  it("explains an empty catalogue separately from an empty filter result", async () => {
    fetchCoursesMock.mockResolvedValue(coursePage({ items: [], total: 0 }));
    const user = userEvent.setup();

    renderPage();
    expect(await screen.findByText(/no courses in your region yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Online" }));
    expect(await screen.findByText(/no courses match those filters yet/i)).toBeInTheDocument();
  });

  it("offers an empty state when no webinar is upcoming", async () => {
    fetchWebinarsMock.mockResolvedValue(webinarPage({ items: [], total: 0 }));

    renderPage();

    expect(await screen.findByText(/no upcoming webinars right now/i)).toBeInTheDocument();
  });

  it("prices a free course as free and a priced course in its currency", async () => {
    fetchCoursesMock.mockResolvedValue(
      coursePage({
        items: [
          buildCourse({ id: "free", title: "Free CPD webinar", price: null, currency: null }),
          buildCourse({ id: "paid", title: "Paid masterclass" }),
        ],
        total: 2,
      }),
    );

    renderPage();

    expect(await screen.findByText("Free CPD")).toBeInTheDocument();
    expect(screen.getByText("Paid masterclass")).toBeInTheDocument();
    expect(screen.getByText(/ksh\s?12,500/i)).toBeInTheDocument();
  });
});
