/**
 * Typed client for the training-provider dashboard, mirroring the backend
 * Pydantic models in `backend/app/logic/v1/training_provider.py`.
 *
 * A course's `price` crosses the wire as a **JSON string** (Pydantic serialises
 * `Decimal` that way); this client keeps it as the exact string the server sent
 * and never parses to a float. A free course has both `price` and `currency`
 * null. `cpd_points` is a plain integer.
 */

import { ApiError, getJson, patchJson, postJson } from "./apiClient";
import type { TrainingDeliveryMode } from "./trainingApi";

/** The signed-in provider's own organising body. */
export interface TrainingProviderProfile {
  id: string;
  name: string;
  countryCode: string;
  isVerified: boolean;
  createdAt: string;
}

/** Derived headline numbers for the dashboard. */
export interface TrainingProviderStats {
  courseCount: number;
  webinarCount: number;
  upcomingWebinarCount: number;
  totalCpdPoints: number;
}

export interface TrainingProviderDashboard {
  provider: TrainingProviderProfile;
  stats: TrainingProviderStats;
}

/** One of the provider's own courses. */
export interface ProviderCourse {
  id: string;
  title: string;
  description: string;
  countryCode: string;
  subdivisionCode: string;
  deliveryMode: TrainingDeliveryMode;
  /** Exact decimal string when priced; `null` means free CPD. */
  price: string | null;
  currency: string | null;
  cpdPoints: number;
  createdAt: string;
  updatedAt: string;
}

/** One of the provider's own webinars. */
export interface ProviderWebinar {
  id: string;
  title: string;
  description: string;
  countryCode: string;
  joinUrl: string;
  /** ISO-8601 timestamp. */
  scheduledStart: string;
  cpdPoints: number;
  createdAt: string;
}

export interface ProviderCoursePage {
  items: ProviderCourse[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProviderWebinarPage {
  items: ProviderWebinar[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateProviderInput {
  name: string;
}

export interface CreateCourseInput {
  title: string;
  description: string;
  subdivisionCode: string;
  deliveryMode: TrainingDeliveryMode;
  /** Decimal string, or `null` for a free course. */
  price: string | null;
  cpdPoints: number;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface CreateWebinarInput {
  title: string;
  description: string;
  joinUrl: string;
  scheduledStart: string;
  cpdPoints: number;
}

export type UpdateWebinarInput = Partial<CreateWebinarInput>;

/* ------------------------------------------------------------------ *
 * Wire types — mirror the JSON exactly, including string money.
 * ------------------------------------------------------------------ */

type WireRecord = Record<string, unknown>;

interface WireProfile extends WireRecord {
  id: string;
  name: string;
  country_code: string;
  is_verified: boolean;
  created_at: string;
}

interface WireStats extends WireRecord {
  course_count: number;
  webinar_count: number;
  upcoming_webinar_count: number;
  total_cpd_points: number;
}

interface WireDashboard extends WireRecord {
  provider: WireProfile;
  stats: WireStats;
}

interface WireCourse extends WireRecord {
  id: string;
  title: string;
  description: string;
  country_code: string;
  subdivision_code: string;
  delivery_mode: TrainingDeliveryMode;
  price: string | null;
  currency: string | null;
  cpd_points: number;
  created_at: string;
  updated_at: string;
}

interface WireWebinar extends WireRecord {
  id: string;
  title: string;
  description: string;
  country_code: string;
  join_url: string;
  scheduled_start: string;
  cpd_points: number;
  created_at: string;
}

interface WireCoursePage extends WireRecord {
  items: WireCourse[];
  total: number;
  limit: number;
  offset: number;
}

interface WireWebinarPage extends WireRecord {
  items: WireWebinar[];
  total: number;
  limit: number;
  offset: number;
}

/* ------------------------------------------------------------------ *
 * Coercion helpers — the contract is trusted, but a stray value must
 * not render as "NaN" on a dashboard card.
 * ------------------------------------------------------------------ */

function toCount(value: unknown, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Keep an API money value as its exact string; `null` passes through. */
function toMoneyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return null;
}

export function mapProviderProfile(wire: WireProfile): TrainingProviderProfile {
  return {
    id: wire.id,
    name: wire.name,
    countryCode: wire.country_code,
    isVerified: Boolean(wire.is_verified),
    createdAt: wire.created_at,
  };
}

function mapStats(wire: WireStats): TrainingProviderStats {
  return {
    courseCount: toCount(wire.course_count, 0),
    webinarCount: toCount(wire.webinar_count, 0),
    upcomingWebinarCount: toCount(wire.upcoming_webinar_count, 0),
    totalCpdPoints: toCount(wire.total_cpd_points, 0),
  };
}

function mapDashboard(wire: WireDashboard): TrainingProviderDashboard {
  return {
    provider: mapProviderProfile(wire.provider),
    stats: mapStats(wire.stats),
  };
}

export function mapProviderCourse(wire: WireCourse): ProviderCourse {
  return {
    id: wire.id,
    title: wire.title,
    description: wire.description,
    countryCode: wire.country_code,
    subdivisionCode: wire.subdivision_code,
    deliveryMode: wire.delivery_mode,
    price: toMoneyString(wire.price),
    currency: wire.currency,
    cpdPoints: toCount(wire.cpd_points, 0),
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

export function mapProviderWebinar(wire: WireWebinar): ProviderWebinar {
  return {
    id: wire.id,
    title: wire.title,
    description: wire.description,
    countryCode: wire.country_code,
    joinUrl: wire.join_url,
    scheduledStart: wire.scheduled_start,
    cpdPoints: toCount(wire.cpd_points, 0),
    createdAt: wire.created_at,
  };
}

function mapCoursePage(wire: WireCoursePage): ProviderCoursePage {
  return {
    items: (wire.items ?? []).map(mapProviderCourse),
    total: toCount(wire.total, 0),
    limit: toCount(wire.limit, 0),
    offset: toCount(wire.offset, 0),
  };
}

function mapWebinarPage(wire: WireWebinarPage): ProviderWebinarPage {
  return {
    items: (wire.items ?? []).map(mapProviderWebinar),
    total: toCount(wire.total, 0),
    limit: toCount(wire.limit, 0),
    offset: toCount(wire.offset, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

/**
 * The caller's provider dashboard, or `null` when they have not created a
 * provider yet (the backend answers 404, which is a data state, not an error).
 */
export function fetchMyProviderDashboard(
  signal?: AbortSignal,
): Promise<TrainingProviderDashboard | null> {
  return getJson<WireDashboard>("/training/me", { auth: true, signal })
    .then(mapDashboard)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    });
}

export function createMyProvider(
  input: CreateProviderInput,
  signal?: AbortSignal,
): Promise<TrainingProviderDashboard> {
  return postJson<WireDashboard>("/training/me", { name: input.name }, { auth: true, signal }).then(
    mapDashboard,
  );
}

export function fetchMyCourses(
  limit: number,
  offset = 0,
  signal?: AbortSignal,
): Promise<ProviderCoursePage> {
  return getJson<WireCoursePage>("/training/me/courses", {
    query: { limit, offset },
    auth: true,
    signal,
  }).then(mapCoursePage);
}

export function fetchMyWebinars(
  limit: number,
  offset = 0,
  signal?: AbortSignal,
): Promise<ProviderWebinarPage> {
  return getJson<WireWebinarPage>("/training/me/webinars", {
    query: { limit, offset },
    auth: true,
    signal,
  }).then(mapWebinarPage);
}

function toCourseBody(input: CreateCourseInput | UpdateCourseInput): WireRecord {
  const body: WireRecord = {};

  if (input.title !== undefined) body.title = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.subdivisionCode !== undefined) body.subdivision_code = input.subdivisionCode;
  if (input.deliveryMode !== undefined) body.delivery_mode = input.deliveryMode;
  if (input.price !== undefined) body.price = input.price;
  if (input.cpdPoints !== undefined) body.cpd_points = input.cpdPoints;

  return body;
}

function toWebinarBody(input: CreateWebinarInput | UpdateWebinarInput): WireRecord {
  const body: WireRecord = {};

  if (input.title !== undefined) body.title = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.joinUrl !== undefined) body.join_url = input.joinUrl;
  if (input.scheduledStart !== undefined) body.scheduled_start = input.scheduledStart;
  if (input.cpdPoints !== undefined) body.cpd_points = input.cpdPoints;

  return body;
}

export function createCourse(
  input: CreateCourseInput,
  signal?: AbortSignal,
): Promise<ProviderCourse> {
  return postJson<WireCourse>("/training/me/courses", toCourseBody(input), {
    auth: true,
    signal,
  }).then(mapProviderCourse);
}

export function updateCourse(
  courseId: string,
  changes: UpdateCourseInput,
  signal?: AbortSignal,
): Promise<ProviderCourse> {
  return patchJson<WireCourse>(
    `/training/me/courses/${encodeURIComponent(courseId)}`,
    toCourseBody(changes),
    { auth: true, signal },
  ).then(mapProviderCourse);
}

export function createWebinar(
  input: CreateWebinarInput,
  signal?: AbortSignal,
): Promise<ProviderWebinar> {
  return postJson<WireWebinar>("/training/me/webinars", toWebinarBody(input), {
    auth: true,
    signal,
  }).then(mapProviderWebinar);
}

export function updateWebinar(
  webinarId: string,
  changes: UpdateWebinarInput,
  signal?: AbortSignal,
): Promise<ProviderWebinar> {
  return patchJson<WireWebinar>(
    `/training/me/webinars/${encodeURIComponent(webinarId)}`,
    toWebinarBody(changes),
    { auth: true, signal },
  ).then(mapProviderWebinar);
}
