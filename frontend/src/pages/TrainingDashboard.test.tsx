import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ProviderCourse,
  type ProviderWebinar,
  type TrainingProviderDashboard,
  createCourse,
  createMyProvider,
  fetchMyCourses,
  fetchMyProviderDashboard,
  fetchMyWebinars,
  updateCourse,
} from "../lib/trainingProviderApi";
import { TrainingDashboard } from "./TrainingDashboard";

vi.mock("../lib/trainingProviderApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/trainingProviderApi")>();

  return {
    ...actual,
    fetchMyProviderDashboard: vi.fn(),
    fetchMyCourses: vi.fn(),
    fetchMyWebinars: vi.fn(),
    createMyProvider: vi.fn(),
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    createWebinar: vi.fn(),
    updateWebinar: vi.fn(),
  };
});

const dashboardMock = vi.mocked(fetchMyProviderDashboard);
const coursesMock = vi.mocked(fetchMyCourses);
const webinarsMock = vi.mocked(fetchMyWebinars);
const createProviderMock = vi.mocked(createMyProvider);
const createCourseMock = vi.mocked(createCourse);
const updateCourseMock = vi.mocked(updateCourse);

const dashboard: TrainingProviderDashboard = {
  provider: {
    id: "provider-1",
    name: "Nairobi CPD Collective",
    countryCode: "KE",
    isVerified: false,
    createdAt: "2026-01-01T00:00:00",
  },
  stats: {
    courseCount: 1,
    webinarCount: 1,
    upcomingWebinarCount: 1,
    totalCpdPoints: 8,
  },
};

const course: ProviderCourse = {
  id: "course-1",
  title: "Rotary Endo Refresher",
  description: "A hands-on day of rotary endodontics.",
  countryCode: "KE",
  subdivisionCode: "NAIROBI",
  deliveryMode: "in_person",
  price: "45000.00",
  currency: "KES",
  cpdPoints: 6,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: "2026-01-01T00:00:00",
};

const webinar: ProviderWebinar = {
  id: "webinar-1",
  title: "Infection Control Update",
  description: "The year's sterilisation changes.",
  countryCode: "KE",
  joinUrl: "https://denthub.test/webinar/ic",
  scheduledStart: "2026-11-01T10:00:00",
  cpdPoints: 2,
  createdAt: "2026-01-01T00:00:00",
};

function emptyCourses() {
  return { items: [], total: 0, limit: 48, offset: 0 };
}

function emptyWebinars() {
  return { items: [], total: 0, limit: 48, offset: 0 };
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <TrainingDashboard />
    </QueryClientProvider>,
  );
}

describe("TrainingDashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    coursesMock.mockResolvedValue(emptyCourses());
    webinarsMock.mockResolvedValue(emptyWebinars());
  });

  it("asks a new provider to create a profile", async () => {
    dashboardMock.mockResolvedValue(null);

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: /create your provider profile/i }),
    ).toBeInTheDocument();
    // The record is created via the region's Accept-Country, so no country input.
    expect(screen.queryByLabelText(/country/i)).toBeNull();
  });

  it("creates a provider and reveals the dashboard", async () => {
    dashboardMock.mockResolvedValueOnce(null).mockResolvedValue(dashboard);
    createProviderMock.mockResolvedValue(dashboard);
    const user = userEvent.setup();

    renderDashboard();

    const name = await screen.findByLabelText(/provider name/i);
    await user.type(name, "Nairobi CPD Collective");
    await user.click(screen.getByRole("button", { name: /create provider/i }));

    await waitFor(() =>
      expect(createProviderMock).toHaveBeenCalledWith({ name: "Nairobi CPD Collective" }),
    );
    expect(
      await screen.findByRole("heading", { name: /nairobi cpd collective/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pending verification/i)).toBeInTheDocument();
  });

  it("shows the provider's derived stats and its own records", async () => {
    dashboardMock.mockResolvedValue(dashboard);
    coursesMock.mockResolvedValue({ items: [course], total: 1, limit: 48, offset: 0 });
    webinarsMock.mockResolvedValue({ items: [webinar], total: 1, limit: 48, offset: 0 });

    renderDashboard();

    expect(await screen.findByText(/total cpd points/i)).toBeInTheDocument();
    expect(screen.getByText("Upcoming webinars")).toBeInTheDocument();
    expect(await screen.findByText("Rotary Endo Refresher")).toBeInTheDocument();
    expect(screen.getByText("6 CPD")).toBeInTheDocument();
    expect(await screen.findByText("Infection Control Update")).toBeInTheDocument();
  });

  it("opens the add-course form and creates a course", async () => {
    dashboardMock.mockResolvedValue(dashboard);
    createCourseMock.mockResolvedValue(course);
    const user = userEvent.setup();

    renderDashboard();

    await screen.findByText(
      "No courses yet. Add your first course to appear in the training catalogue.",
    );
    await user.click(screen.getByRole("button", { name: /add course/i }));

    await user.type(screen.getByLabelText(/title/i), "Rotary Endo Refresher");
    await user.type(screen.getByLabelText(/description/i), "A hands-on day.");
    await user.click(screen.getByRole("button", { name: /create course/i }));

    await waitFor(() =>
      expect(createCourseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Rotary Endo Refresher",
          description: "A hands-on day.",
          deliveryMode: "in_person",
          price: null,
          cpdPoints: 0,
        }),
      ),
    );
  });

  it("edits an existing course through a prefilled form", async () => {
    dashboardMock.mockResolvedValue(dashboard);
    coursesMock.mockResolvedValue({ items: [course], total: 1, limit: 48, offset: 0 });
    updateCourseMock.mockResolvedValue(course);
    const user = userEvent.setup();

    renderDashboard();

    await screen.findByText("Rotary Endo Refresher");
    await user.click(screen.getByRole("button", { name: /edit/i }));

    const title = screen.getByLabelText(/title/i);
    expect(title).toHaveValue("Rotary Endo Refresher");
    await user.clear(title);
    await user.type(title, "Advanced Endo");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateCourseMock).toHaveBeenCalledWith(
        "course-1",
        expect.objectContaining({ title: "Advanced Endo" }),
      ),
    );
  });
});
