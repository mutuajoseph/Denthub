import type { CourseSpecialty } from "../config/courseConstants";

export interface Course {
  readonly id: string;
  readonly title: string;
  readonly provider: string;
  /** Lower-cased delivery format: `online`, `physical` or `workshop`. */
  readonly format: string;
  readonly specialty: CourseSpecialty;
  readonly location: string;
  readonly date: string;
  readonly duration: string;
  readonly cpdPoints: number;
  /** Whole-unit amount in the region's currency, or `null` when included in a bundle. */
  readonly price: number | null;
  readonly rating: number;
  readonly enrolled: number;
  readonly isNew: boolean;
}

export interface Webinar {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly time: string;
  readonly speaker: string;
  readonly free: boolean;
}

/** Fixture-backed: there is no training backend yet. */
const COURSES: readonly Course[] = [
  {
    id: "course-rotative-endodontics",
    title: "Rotative Endodontics Essentials",
    provider: "Nairobi Dental Academy",
    format: "workshop",
    specialty: "Endodontics",
    location: "Nairobi",
    date: "Starts 12 Feb",
    duration: "2 days",
    cpdPoints: 12,
    price: 45000,
    rating: 4.8,
    enrolled: 24,
    isNew: true,
  },
  {
    id: "course-clear-aligners",
    title: "Clear Aligner Case Planning",
    provider: "Coast Orthodontics Institute",
    format: "physical",
    specialty: "Orthodontics",
    location: "Mombasa",
    date: "Starts 5 Mar",
    duration: "3 days",
    cpdPoints: 18,
    price: 78000,
    rating: 4.7,
    enrolled: 18,
    isNew: false,
  },
  {
    id: "course-implant-planning",
    title: "Implant Planning for the General Dentist",
    provider: "DentHub Learning",
    format: "online",
    specialty: "Prosthodontics",
    location: "Online",
    date: "On demand",
    duration: "6 weeks",
    cpdPoints: 20,
    price: 32000,
    rating: 4.6,
    enrolled: 61,
    isNew: false,
  },
  {
    id: "course-paediatric-sedation",
    title: "Safe Sedation in Paediatric Dentistry",
    provider: "Nairobi Dental Academy",
    format: "workshop",
    specialty: "Paediatric",
    location: "Nairobi",
    date: "Starts 19 Mar",
    duration: "1 day",
    cpdPoints: 8,
    price: 28000,
    rating: 4.9,
    enrolled: 31,
    isNew: true,
  },
  {
    id: "course-periodontal-surgery",
    title: "Periodontal Surgery Techniques",
    provider: "Lake Basin Dental Institute",
    format: "physical",
    specialty: "Periodontics",
    location: "Kisumu",
    date: "Starts 2 Apr",
    duration: "2 days",
    cpdPoints: 14,
    price: 52000,
    rating: 4.5,
    enrolled: 12,
    isNew: false,
  },
  {
    id: "course-digital-impressions",
    title: "Digital Impressions & CAD/CAM",
    provider: "DentHub Learning",
    format: "online",
    specialty: "Digital Dentistry",
    location: "Online",
    date: "On demand",
    duration: "4 weeks",
    cpdPoints: 10,
    price: 24000,
    rating: 4.4,
    enrolled: 47,
    isNew: false,
  },
  {
    id: "course-oral-surgery-refresher",
    title: "Oral Surgery Refresher",
    provider: "Coast Dental Academy",
    format: "physical",
    specialty: "Oral Surgery",
    location: "Mombasa",
    date: "Starts 16 Apr",
    duration: "2 days",
    cpdPoints: 16,
    price: 61000,
    rating: 4.7,
    enrolled: 9,
    isNew: false,
  },
  {
    id: "course-prosthetics-masterclass",
    title: "Prosthetics Masterclass: Full Arch",
    provider: "DentHub Learning",
    format: "online",
    specialty: "Prosthodontics",
    location: "Online",
    date: "Starts 30 Apr",
    duration: "8 weeks",
    cpdPoints: 24,
    price: null,
    rating: 4.9,
    enrolled: 38,
    isNew: true,
  },
];

const WEBINARS: readonly Webinar[] = [
  {
    id: "webinar-articulation",
    title: "Articulation in Complete Dentures",
    date: "24 Jan",
    time: "4:00 PM EAT",
    speaker: "Dr. W. Otieno",
    free: true,
  },
  {
    id: "webinar-infection-control",
    title: "Infection Control Update 2026",
    date: "28 Jan",
    time: "5:30 PM EAT",
    speaker: "Dr. A. Mohamed",
    free: true,
  },
  {
    id: "webinar-practice-management",
    title: "Running a Modern Dental Practice",
    date: "31 Jan",
    time: "6:00 PM EAT",
    speaker: "Dr. L. Kariuki",
    free: false,
  },
];

export function listCourseFixtures(): readonly Course[] {
  return COURSES;
}

export function listWebinarFixtures(): readonly Webinar[] {
  return WEBINARS;
}
