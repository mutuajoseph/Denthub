/**
 * Static states / counties / provinces when API is offline or DB not seeded.
 * Names align with denthub-api seed where applicable.
 */

export interface Subdivision {
  id: string;
  name: string;
  code: string;
  countryCode: string;
  _static?: boolean;
}

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Mark}+/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

function pack(countryCode: string, items: { name: string; code?: string }[]): Subdivision[] {
  return items.map(({ name, code }) => ({
    id: `static-${countryCode}-${code || slug(name)}`,
    name,
    code: code || slug(name),
    countryCode,
    _static: true,
  }));
}

const KE_COUNTIES = [
  "Baringo",
  "Bomet",
  "Bungoma",
  "Busia",
  "Elgeyo-Marakwet",
  "Embu",
  "Garissa",
  "Homa Bay",
  "Isiolo",
  "Kajiado",
  "Kakamega",
  "Kericho",
  "Kiambu",
  "Kilifi",
  "Kirinyaga",
  "Kisii",
  "Kisumu",
  "Kitui",
  "Kwale",
  "Laikipia",
  "Lamu",
  "Machakos",
  "Makueni",
  "Mandera",
  "Marsabit",
  "Meru",
  "Migori",
  "Mombasa",
  "Murang'a",
  "Nairobi",
  "Nakuru",
  "Nandi",
  "Narok",
  "Nyamira",
  "Nyandarua",
  "Nyeri",
  "Samburu",
  "Siaya",
  "Taita-Taveta",
  "Tana River",
  "Tharaka-Nithi",
  "Trans Nzoia",
  "Turkana",
  "Uasin Gishu",
  "Vihiga",
  "Wajir",
  "West Pokot",
];

const NG_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const ZA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const GB_NATIONS = ["England", "Scotland", "Wales", "Northern Ireland"];

const AE_EMIRATES = [
  "Abu Dhabi",
  "Ajman",
  "Dubai",
  "Fujairah",
  "Ras Al Khaimah",
  "Sharjah",
  "Umm Al Quwain",
];

const IN_STATES_AND_UTS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const TR_PROVINCES = [
  "Adana",
  "Adiyaman",
  "Afyonkarahisar",
  "Agri",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydin",
  "Balikesir",
  "Bartin",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingol",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Canakkale",
  "Cankiri",
  "Corum",
  "Denizli",
  "Diyarbakir",
  "Duzce",
  "Edirne",
  "Elazig",
  "Erzincan",
  "Erzurum",
  "Eskisehir",
  "Gaziantep",
  "Giresun",
  "Gumushane",
  "Hakkari",
  "Hatay",
  "Igdir",
  "Isparta",
  "Istanbul",
  "Izmir",
  "Kahramanmaras",
  "Karabuk",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kilis",
  "Kirikkale",
  "Kirklareli",
  "Kirsehir",
  "Kocaeli",
  "Konya",
  "Kutahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Mugla",
  "Mus",
  "Nevsehir",
  "Nigde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Sanliurfa",
  "Siirt",
  "Sinop",
  "Sirnak",
  "Sivas",
  "Tekirdag",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Usak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak",
];

export const SUBDIVISIONS_BY_COUNTRY: Record<string, Subdivision[]> = {
  KE: pack(
    "KE",
    KE_COUNTIES.map((name) => ({ name })),
  ),
  NG: pack(
    "NG",
    NG_STATES.map((name) => ({
      name,
      code: name === "FCT" ? "FCT" : slug(name),
    })),
  ),
  ZA: pack(
    "ZA",
    ZA_PROVINCES.map((name) => ({ name })),
  ),
  US: pack(
    "US",
    US_STATES.map((name) => ({ name })),
  ),
  GB: pack(
    "GB",
    GB_NATIONS.map((name) => ({ name })),
  ),
  AE: pack(
    "AE",
    AE_EMIRATES.map((name) => ({ name })),
  ),
  IN: pack(
    "IN",
    IN_STATES_AND_UTS.map((name) => ({ name })),
  ),
  TR: pack(
    "TR",
    TR_PROVINCES.map((name) => ({ name })),
  ),
};

export function getStaticSubdivisions(countryCode: string): Subdivision[] {
  const code = countryCode?.toUpperCase();
  return SUBDIVISIONS_BY_COUNTRY[code] || [];
}

export function mergeSubdivisionLists(
  apiRegions: { id: string; name: string; code?: string; countryCode?: string }[] | undefined,
  countryCode: string,
): Subdivision[] {
  if (apiRegions?.length) {
    return apiRegions.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code || slug(r.name),
      countryCode: r.countryCode || countryCode,
      _static: false,
    }));
  }
  return getStaticSubdivisions(countryCode);
}

export function isStaticSubdivisionId(value: string): boolean {
  return typeof value === "string" && value.startsWith("static-");
}

export function subdivisionToSearchParams(
  value?: string,
  options: { id: string; name: string }[] = [],
): { regionName?: string; regionId?: string } {
  if (!value) return {};
  const row = options.find((o) => o.id === value);
  if (!row) return {};
  if (isStaticSubdivisionId(value)) {
    return { regionName: row.name };
  }
  return { regionId: row.id };
}
