export type CountryCode = "KE" | "GB" | "US" | "AE" | "NG" | "ZA" | "IN" | "TR";
export type DentistListingType = "specialist" | "practice";

export interface DentistLocation {
  readonly countryCode: CountryCode;
  readonly subdivision: string;
  readonly city: string;
  readonly operatingAreas: readonly string[];
}

export interface DentistInsurance {
  readonly nationalScheme: string | null;
  readonly accepted: readonly string[];
}

export interface DentistHours {
  readonly summary: string;
  readonly openNow: boolean;
}

export interface DentistPricing {
  readonly amount: number;
  readonly currency: string;
}

export interface DentistContact {
  readonly phone: string;
}

export interface DentistVerification {
  readonly verified: boolean;
  readonly approved: boolean;
  readonly excellence: boolean;
}

export interface DentistListing {
  readonly id: string;
  readonly listingType: DentistListingType;
  readonly name: string;
  readonly clinic: string | null;
  readonly specialties: readonly string[];
  readonly location: DentistLocation;
  readonly rating: number;
  readonly reviewCount: number;
  readonly insurance: DentistInsurance;
  readonly hours: DentistHours;
  readonly pricing: DentistPricing;
  readonly contact: DentistContact;
  readonly verification: DentistVerification;
  readonly teamSize?: number;
}

export interface LegacyListingBase {
  readonly id: string;
  readonly name: string;
  readonly specialty: readonly string[];
  readonly county: string;
  readonly town: string;
  readonly rating: number;
  readonly reviews: number;
  readonly nhif: boolean;
  readonly insurance: readonly string[];
  readonly verified: boolean;
  readonly approved: boolean;
  readonly excellence: boolean;
  readonly openNow: boolean;
  readonly hours: string;
  readonly priceFrom: number;
  readonly phone: string;
  readonly countryCode?: CountryCode;
  readonly currency?: string;
  readonly nationalInsurance?: string | null;
}

export interface LegacySpecialistFixture extends LegacyListingBase {
  readonly listingType: "specialist";
  readonly clinic: string;
}

export interface LegacyPracticeFixture extends LegacyListingBase {
  readonly listingType: "practice";
  readonly operatingAreas: readonly string[];
  readonly teamSize?: number;
}

const CURRENCY_BY_COUNTRY: Record<CountryCode, string> = {
  KE: "KES",
  GB: "GBP",
  US: "USD",
  AE: "AED",
  NG: "NGN",
  ZA: "ZAR",
  IN: "INR",
  TR: "TRY",
};

const NATIONAL_INSURANCE_BY_COUNTRY: Record<CountryCode, string> = {
  KE: "NHIF",
  GB: "NHS",
  US: "National dental benefits",
  AE: "Dubai Health Insurance",
  NG: "NHIS",
  ZA: "Discovery Health",
  IN: "PM-JAY",
  TR: "SGK",
};

const LEGACY_SPECIALIST_FIXTURES: readonly LegacySpecialistFixture[] = [
  {
    id: "sp-1",
    listingType: "specialist",
    name: "Dr. Wanjiku Kamau",
    clinic: "SmileCare Dental Centre",
    specialty: ["Implants", "Cosmetic"],
    county: "Nairobi",
    town: "Westlands",
    rating: 4.9,
    reviews: 187,
    nhif: true,
    insurance: ["Jubilee", "AAR"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Sat 8am-7pm",
    priceFrom: 2500,
    phone: "+254712345678",
  },
  {
    id: "sp-2",
    listingType: "specialist",
    name: "Dr. Peter Mwangi",
    clinic: "Upper Hill Dental Specialists",
    specialty: ["Oral & Maxillofacial Surgery", "Implants"],
    county: "Nairobi",
    town: "Upper Hill",
    rating: 4.8,
    reviews: 112,
    nhif: true,
    insurance: ["AAR", "Jubilee"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Fri 8am-5pm",
    priceFrom: 8000,
    phone: "+254745678901",
  },
  {
    id: "sp-3",
    listingType: "specialist",
    name: "Dr. James Ochieng",
    clinic: "Lakeview Dental Clinic",
    specialty: ["Implants", "Oral Surgery"],
    county: "Kisumu",
    town: "Kisumu CBD",
    rating: 4.7,
    reviews: 94,
    nhif: true,
    insurance: ["Britam"],
    verified: true,
    approved: true,
    excellence: false,
    openNow: false,
    hours: "Mon-Fri 9am-5pm",
    priceFrom: 4500,
    phone: "+254723456789",
  },
  {
    id: "sp-4",
    listingType: "specialist",
    name: "Dr. Fatima Hassan",
    clinic: "Coast Maxillofacial Centre",
    specialty: ["Oral & Maxillofacial Surgery", "Oral Surgery"],
    county: "Mombasa",
    town: "Nyali",
    rating: 4.8,
    reviews: 156,
    nhif: false,
    insurance: ["Jubilee", "AAR", "Britam"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Sat 7:30am-6pm",
    priceFrom: 6000,
    phone: "+254734567890",
  },
  {
    id: "sp-5",
    listingType: "specialist",
    name: "Dr. Samuel Otieno",
    clinic: "Machakos Dental Care",
    specialty: ["Implants", "Endodontics"],
    county: "Machakos",
    town: "Machakos",
    rating: 4.7,
    reviews: 89,
    nhif: true,
    insurance: ["AAR", "Jubilee"],
    verified: true,
    approved: true,
    excellence: false,
    openNow: false,
    hours: "Mon-Fri 8am-5pm",
    priceFrom: 3500,
    phone: "+254789012345",
  },
];

const LEGACY_PRACTICE_FIXTURES: readonly LegacyPracticeFixture[] = [
  {
    id: "pr-1",
    listingType: "practice",
    name: "SmileCare Dental Centre",
    specialty: ["General", "Cosmetic", "Implants"],
    operatingAreas: ["Nairobi", "Kiambu"],
    county: "Nairobi",
    town: "Westlands",
    rating: 4.9,
    reviews: 312,
    nhif: true,
    insurance: ["Jubilee", "AAR", "NHIF"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Sat 8am-7pm",
    priceFrom: 2000,
    phone: "+254712345601",
    teamSize: 6,
  },
  {
    id: "pr-2",
    listingType: "practice",
    name: "Upper Hill Dental Specialists",
    specialty: ["Oral & Maxillofacial Surgery", "Implants", "Oral Surgery"],
    operatingAreas: ["Nairobi", "Nakuru", "Kiambu"],
    county: "Nairobi",
    town: "Upper Hill",
    rating: 4.8,
    reviews: 198,
    nhif: true,
    insurance: ["AAR", "Jubilee"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Fri 8am-6pm",
    priceFrom: 3500,
    phone: "+254712345605",
    teamSize: 4,
  },
  {
    id: "pr-3",
    listingType: "practice",
    name: "Coast Maxillofacial Centre",
    specialty: ["Oral & Maxillofacial Surgery", "Implants"],
    operatingAreas: ["Mombasa", "Kilifi", "Kwale"],
    county: "Mombasa",
    town: "Nyali",
    rating: 4.7,
    reviews: 145,
    nhif: false,
    insurance: ["Britam", "Jubilee"],
    verified: true,
    approved: true,
    excellence: false,
    openNow: true,
    hours: "Mon-Sat 8am-6pm",
    priceFrom: 4000,
    phone: "+254734567891",
    teamSize: 3,
  },
  {
    id: "pr-4",
    listingType: "practice",
    name: "Rift Valley Oral Surgery",
    specialty: ["Oral Surgery", "Implants", "Endodontics"],
    operatingAreas: ["Nakuru", "Uasin Gishu", "Baringo"],
    county: "Nakuru",
    town: "Nakuru Town",
    rating: 4.6,
    reviews: 72,
    nhif: true,
    insurance: ["AAR"],
    verified: true,
    approved: false,
    excellence: false,
    openNow: true,
    hours: "Mon-Fri 8am-4pm",
    priceFrom: 5000,
    phone: "+254745678902",
    teamSize: 2,
  },
  {
    id: "pr-5",
    listingType: "practice",
    name: "Eldoret Dental Hub",
    specialty: ["Periodontics", "General", "Implants"],
    operatingAreas: ["Uasin Gishu", "Trans Nzoia"],
    county: "Uasin Gishu",
    town: "Eldoret",
    rating: 4.8,
    reviews: 118,
    nhif: true,
    insurance: ["Jubilee"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Sat 8am-8pm",
    priceFrom: 2200,
    phone: "+254767890123",
    teamSize: 5,
  },
];

const INTERNATIONAL_FIXTURES: readonly (LegacySpecialistFixture | LegacyPracticeFixture)[] = [
  {
    id: "ng-sp-1",
    listingType: "specialist",
    name: "Dr. Ada Okafor",
    clinic: "Lagos Dental Specialists",
    specialty: ["Oral & Maxillofacial Surgery", "Implants"],
    county: "Lagos",
    town: "Victoria Island",
    rating: 4.7,
    reviews: 76,
    nhif: false,
    nationalInsurance: "NHIS",
    insurance: ["NHIS", "Leadway"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Fri 8am-5pm",
    priceFrom: 85000,
    phone: "+2348023456789",
    countryCode: "NG",
    currency: "NGN",
  },
  {
    id: "gb-pr-1",
    listingType: "practice",
    name: "Thames Dental Collective",
    specialty: ["General", "Cosmetic", "Orthodontics"],
    operatingAreas: ["England", "London", "Surrey"],
    county: "England",
    town: "London",
    rating: 4.8,
    reviews: 141,
    nhif: false,
    nationalInsurance: "NHS",
    insurance: ["Bupa", "NHS"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Fri 8:30am-6pm",
    priceFrom: 120,
    phone: "+442079460120",
    teamSize: 7,
    countryCode: "GB",
    currency: "GBP",
  },
  {
    id: "us-sp-1",
    listingType: "specialist",
    name: "Dr. Maya Thompson",
    clinic: "Harborview Dental Studio",
    specialty: ["Implants", "Periodontics"],
    county: "California",
    town: "San Francisco",
    rating: 4.9,
    reviews: 203,
    nhif: false,
    nationalInsurance: null,
    insurance: ["Delta Blue Shield", "Cigna"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: false,
    hours: "Tue-Sat 9am-5pm",
    priceFrom: 210,
    phone: "+14155550101",
    countryCode: "US",
    currency: "USD",
  },
  {
    id: "ae-pr-1",
    listingType: "practice",
    name: "Desert Bloom Dental",
    specialty: ["Cosmetic", "Implants", "General"],
    operatingAreas: ["Dubai", "Abu Dhabi"],
    county: "Dubai",
    town: "Dubai",
    rating: 4.7,
    reviews: 98,
    nhif: false,
    nationalInsurance: "Dubai Health Insurance",
    insurance: ["Dubai Health Insurance", "Daman"],
    verified: true,
    approved: true,
    excellence: false,
    openNow: true,
    hours: "Sun-Thu 9am-8pm",
    priceFrom: 650,
    phone: "+97145550102",
    teamSize: 9,
    countryCode: "AE",
    currency: "AED",
  },
  {
    id: "za-sp-1",
    listingType: "specialist",
    name: "Dr. Thandi Ndlovu",
    clinic: "Joburg Dental Care",
    specialty: ["Periodontics", "General"],
    county: "Gauteng",
    town: "Johannesburg",
    rating: 4.6,
    reviews: 87,
    nhif: false,
    nationalInsurance: "Discovery Health",
    insurance: ["Discovery Health", "Padi"],
    verified: true,
    approved: true,
    excellence: false,
    openNow: true,
    hours: "Mon-Fri 8am-5pm",
    priceFrom: 850,
    phone: "+27115550103",
    countryCode: "ZA",
    currency: "ZAR",
  },
  {
    id: "in-pr-1",
    listingType: "practice",
    name: "Greenline Dental Mumbai",
    specialty: ["Endodontics", "General", "Cosmetic"],
    operatingAreas: ["Maharashtra", "Mumbai", "Thane"],
    county: "Maharashtra",
    town: "Mumbai",
    rating: 4.8,
    reviews: 164,
    nhif: false,
    nationalInsurance: "PM-JAY",
    insurance: ["PM-JAY", "Tata AIG"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Sat 10am-7pm",
    priceFrom: 1500,
    phone: "+91225550104",
    teamSize: 8,
    countryCode: "IN",
    currency: "INR",
  },
  {
    id: "tr-sp-1",
    listingType: "specialist",
    name: "Dr. Elif Yilmaz",
    clinic: "Bosphorus Dental Studio",
    specialty: ["Orthodontics", "Pediatric"],
    county: "Istanbul",
    town: "Kadikoy",
    rating: 4.9,
    reviews: 119,
    nhif: false,
    nationalInsurance: "SGK",
    insurance: ["SGK", "Anadolu Hayat"],
    verified: true,
    approved: true,
    excellence: true,
    openNow: true,
    hours: "Mon-Sat 9am-7pm",
    priceFrom: 3500,
    phone: "+90212550105",
    countryCode: "TR",
    currency: "TRY",
  },
];

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  Object.freeze(value);
  return value;
}

function mapLegacyListing(source: LegacySpecialistFixture | LegacyPracticeFixture): DentistListing {
  const countryCode = source.countryCode ?? "KE";
  const operatingAreas = source.listingType === "practice" ? source.operatingAreas : [];
  const teamSize = source.listingType === "practice" ? source.teamSize : undefined;
  const nationalScheme =
    source.nationalInsurance ?? (source.nhif ? NATIONAL_INSURANCE_BY_COUNTRY[countryCode] : null);

  return deepFreeze({
    id: source.id,
    listingType: source.listingType,
    name: source.name,
    clinic: source.listingType === "specialist" ? source.clinic : null,
    specialties: [...source.specialty],
    location: {
      countryCode,
      subdivision: source.county,
      city: source.town,
      operatingAreas: [...operatingAreas],
    },
    rating: source.rating,
    reviewCount: source.reviews,
    insurance: {
      nationalScheme,
      accepted: [...source.insurance],
    },
    hours: {
      summary: source.hours,
      openNow: source.openNow,
    },
    pricing: {
      amount: source.priceFrom,
      currency: source.currency ?? CURRENCY_BY_COUNTRY[countryCode],
    },
    contact: {
      phone: source.phone,
    },
    verification: {
      verified: source.verified,
      approved: source.approved,
      excellence: source.excellence,
    },
    ...(teamSize === undefined ? {} : { teamSize }),
  });
}

export function mapLegacySpecialistFixture(source: LegacySpecialistFixture): DentistListing {
  return mapLegacyListing(source);
}

export function mapLegacyPracticeFixture(source: LegacyPracticeFixture): DentistListing {
  return mapLegacyListing(source);
}

export function mapLegacyListingFixture(
  source: LegacySpecialistFixture | LegacyPracticeFixture,
): DentistListing {
  return mapLegacyListing(source);
}

const fixtureListings: DentistListing[] = [
  ...LEGACY_SPECIALIST_FIXTURES.map(mapLegacySpecialistFixture),
  ...LEGACY_PRACTICE_FIXTURES.map(mapLegacyPracticeFixture),
  ...INTERNATIONAL_FIXTURES.map(mapLegacyListingFixture),
];

export const DENTIST_FIXTURES: readonly DentistListing[] = deepFreeze(fixtureListings);
export const DENTIST_LISTINGS = DENTIST_FIXTURES;

export function listDentistFixtures(): readonly DentistListing[] {
  return DENTIST_FIXTURES;
}

export function getDentistFixtureById(id: string | number): DentistListing | undefined {
  const normalizedId = String(id);
  return DENTIST_FIXTURES.find((listing) => listing.id === normalizedId);
}
