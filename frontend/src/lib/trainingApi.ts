/**
 * Contract types for the CPD training endpoints, mirroring the backend Pydantic
 * models in `backend/app/logic/v1/training.py` — `GET /training/courses`,
 * `GET /training/courses/{id}`, `GET /training/webinars`, and
 * `GET /training/webinars/{id}`.
 *
 * The **wire** shape is snake_case exactly as the API answers, with money as a
 * JSON string (`price`) because Pydantic serialises `Decimal` that way — so
 * amounts stay exact and are parsed once, in the mapper, never in a component.
 * A priced course carries its own `currency` on the same row; a free course
 * has both `price` and `currency` null. Webinars are a dated event (a join URL
 * and a scheduled start) and a market without the `CPD_TRAINING` flag answers
 * every `list` call with a 503 the page surfaces as "not available here".
 *
 * The **UI** shape (`CourseView`, `WebinarView`) is camelCase and money is
 * still an exact string. Pages and components only ever read these.
 */

import { getJson } from "./apiClient";
import type { QueryPrimitive } from "./apiClient";

/** Delivery modes a course can be run in, as the API stores them. */
export type TrainingDeliveryMode = "in_person" | "online" | "blended";

/** Narrow `upcoming` to just one side of today (archive semantics). */
export type TrainingUpcomingFilter = "upcoming" | "past";

/** One wire course; a free course has `price` and `currency` both null. */
export interface TrainingCourseWire {
  id: string;
  title: string;
  description: string;
  provider: { name: string; is_verified: boolean };
  subdivision_code: string;
  delivery_mode: TrainingDeliveryMode;
  price: string | null;
  currency: string | null;
}

/** One page of courses, plus the market it is priced in. */
export interface TrainingCoursePageWire {
  items: TrainingCourseWire[];
  total: number;
  limit: number;
  offset: number;
  country_code: string;
  currency: string;
}

/** One wire webinar; `scheduled_start` arrives as an ISO-8601 timestamp. */
export interface TrainingWebinarWire {
  id: string;
  title: string;
  description: string;
  provider: { name: string; is_verified: boolean };
  join_url: string;
  scheduled_start: string;
}

/** One page of webinars, plus the market it belongs to. */
export interface TrainingWebinarPageWire {
  items: TrainingWebinarWire[];
  total: number;
  limit: number;
  offset: number;
  country_code: string;
}

/** Every input `fetchTrainingCourses` reads; also the query key's inputs. */
export interface TrainingCourseParams {
  /** The market being asked about (`apiCountry`, never `GLOBAL`). */
  country: string;
  /** Filter to one subdivision code, e.g. `NAIROBI`. */
  subdivisionCode?: string;
  /** Filter to one provider by name (case-insensitive). */
  provider?: string;
  /** Filter to one delivery mode. */
  deliveryMode?: TrainingDeliveryMode;
  /** Page size. The backend caps `limit` at 100. */
  limit?: number;
  offset?: number;
}

/** Every input `fetchTrainingWebinars` reads; also the query key's inputs. */
export interface TrainingWebinarParams {
  /** The market being asked about (`apiCountry`, never `GLOBAL`). */
  country: string;
  /** Filter to one provider by name (case-insensitive). */
  provider?: string;
  /** Default keeps the archive; `upcoming`/`past` narrow to one side of today. */
  upcoming?: TrainingUpcomingFilter;
  /** Page size. The backend caps `limit` at 100. */
  limit?: number;
  offset?: number;
}

export async function fetchTrainingCourses(
  params: TrainingCourseParams,
  signal?: AbortSignal,
): Promise<TrainingCoursePageWire> {
  const { country, subdivisionCode, provider, deliveryMode, limit, offset } = params;

  const query: Record<string, QueryPrimitive | undefined> = {
    country,
    subdivision_code: subdivisionCode,
    provider,
    delivery_mode: deliveryMode,
    limit,
    offset,
  };

  return getJson<TrainingCoursePageWire>("/training/courses", { query, signal });
}

export function fetchTrainingCourse(id: string, signal?: AbortSignal): Promise<TrainingCourseWire> {
  return getJson<TrainingCourseWire>(`/training/courses/${encodeURIComponent(id)}`, { signal });
}

export async function fetchTrainingWebinars(
  params: TrainingWebinarParams,
  signal?: AbortSignal,
): Promise<TrainingWebinarPageWire> {
  const { country, provider, upcoming, limit, offset } = params;

  const query: Record<string, QueryPrimitive | undefined> = {
    country,
    provider,
    upcoming,
    limit,
    offset,
  };

  return getJson<TrainingWebinarPageWire>("/training/webinars", { query, signal });
}

export function fetchTrainingWebinar(
  id: string,
  signal?: AbortSignal,
): Promise<TrainingWebinarWire> {
  return getJson<TrainingWebinarWire>(`/training/webinars/${encodeURIComponent(id)}`, { signal });
}

/* ------------------------------------------------------------------ *
 * UI model
 * ------------------------------------------------------------------ */

/** One course as the UI reads it: money still an exact string. */
export interface CourseView {
  id: string;
  title: string;
  description: string;
  providerName: string;
  providerVerified: boolean;
  subdivisionCode: string;
  deliveryMode: TrainingDeliveryMode;
  /** Exact decimal string when priced; `null` means free CPD. */
  price: string | null;
  /** Present exactly when `price` is (per-row currency). */
  currency: string | null;
}

/** One webinar as the UI reads it. */
export interface WebinarView {
  id: string;
  title: string;
  description: string;
  providerName: string;
  providerVerified: boolean;
  joinUrl: string;
  scheduledStart: string;
}

/** One page of courses as the UI reads it. */
export interface TrainingCoursePage {
  items: CourseView[];
  total: number;
  limit: number;
  offset: number;
  countryCode: string;
  currency: string;
}

/** One page of webinars as the UI reads it. */
export interface TrainingWebinarPage {
  items: WebinarView[];
  total: number;
  limit: number;
  offset: number;
  countryCode: string;
}

/* ------------------------------------------------------------------ *
 * Mappers
 * ------------------------------------------------------------------ */

export function mapCourse(wire: TrainingCourseWire): CourseView {
  return {
    id: wire.id,
    title: wire.title,
    description: wire.description,
    providerName: wire.provider.name,
    providerVerified: wire.provider.is_verified,
    subdivisionCode: wire.subdivision_code,
    deliveryMode: wire.delivery_mode,
    price: wire.price,
    currency: wire.currency,
  };
}

export function mapWebinar(wire: TrainingWebinarWire): WebinarView {
  return {
    id: wire.id,
    title: wire.title,
    description: wire.description,
    providerName: wire.provider.name,
    providerVerified: wire.provider.is_verified,
    joinUrl: wire.join_url,
    scheduledStart: wire.scheduled_start,
  };
}

export function mapCoursePage(wire: TrainingCoursePageWire): TrainingCoursePage {
  return {
    items: wire.items.map(mapCourse),
    total: wire.total,
    limit: wire.limit,
    offset: wire.offset,
    countryCode: wire.country_code,
    currency: wire.currency,
  };
}

export function mapWebinarPage(wire: TrainingWebinarPageWire): TrainingWebinarPage {
  return {
    items: wire.items.map(mapWebinar),
    total: wire.total,
    limit: wire.limit,
    offset: wire.offset,
    countryCode: wire.country_code,
  };
}

/* ------------------------------------------------------------------ *
 * Display helpers
 * ------------------------------------------------------------------ */

/** "24 Jan · 4:00 PM" from the API's `scheduled_start`, without a date library. */
export function webinarWhen(scheduledStart: string): string {
  const date = new Date(scheduledStart);
  if (Number.isNaN(date.getTime())) return "";

  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}
