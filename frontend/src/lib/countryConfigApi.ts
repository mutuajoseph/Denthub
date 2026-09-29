/**
 * Country reference and configuration API.
 *
 * The client asks "what does country X look like?" before it fetches any
 * listing: currency, subdivision labels, which modules that market offers, and
 * its states/counties. That is a whole country in one payload, so it is
 * fetched once per country and reused by every page.
 *
 * The wire types below mirror the backend Pydantic models in
 * `app/logic/v1/country.py`; `mapCountryConfig` is the only place that turns
 * snake_case wire fields into the camelCase shape the UI reads.
 */

import type { Subdivision } from "../config/subdivisions";
import { API_BASE } from "./api";
import { getJson } from "./apiClient";

/** Module keys. A country with no row for one of these does not offer it. */
export type CountryFeatureKey =
  | "DENTAL_INSURANCE"
  | "ORAL_CARE_SHOP"
  | "JOBS_BOARD"
  | "CPD_TRAINING";

export interface CountryGeographyWire {
  subdivision_label: string;
  subdivision_label_plural: string;
  city_label: string;
}

export interface CountryFeatureWire {
  feature: string;
  is_enabled: boolean;
  primary_scheme: string | null;
}

export interface InsuranceProviderWire {
  name: string;
  is_national: boolean;
}

export interface SubdivisionWire {
  code: string;
  name: string;
  country_code: string;
}

export interface CountryConfigWire {
  code: string;
  name: string;
  currency: string;
  currency_symbol: string;
  locale: string;
  timezone: string;
  phone_prefix: string;
  default_locale: string;
  geography: CountryGeographyWire;
  features: CountryFeatureWire[];
  insurance_providers: InsuranceProviderWire[];
  subdivisions: SubdivisionWire[];
}

export interface CountrySummaryWire {
  code: string;
  name: string;
  currency: string;
  currency_symbol: string;
  locale: string;
  default_locale: string;
  timezone: string;
  phone_prefix: string;
  subdivision_label: string;
  subdivision_label_plural: string;
  city_label: string;
}

export interface CountryListWire {
  items: CountrySummaryWire[];
  default_country_code: string;
}

export interface SubdivisionListWire {
  country_code: string;
  items: SubdivisionWire[];
}

export interface SpecialtyWire {
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface SpecialtyListWire {
  items: SpecialtyWire[];
}

/** The shape the UI reads, assembled from the wire by {@link mapCountryConfig}. */
export interface CountryConfig {
  code: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  geography: {
    subdivisionLabel: string;
    subdivisionPlural: string;
    cityLabel: string;
  };
  features: Record<string, boolean>;
  featureConfigs: Record<string, { primaryScheme: string | null }>;
  featureContexts: Record<string, { insuranceProviders: string[] }>;
  insuranceProviders: string[];
  regions: Subdivision[];
}

function toSubdivision(row: SubdivisionWire): Subdivision {
  return {
    id: `${row.country_code}-${row.code}`,
    name: row.name,
    code: row.code,
    countryCode: row.country_code,
  };
}

export function mapCountryConfig(wire: CountryConfigWire): CountryConfig {
  const features: Record<string, boolean> = {};
  const featureConfigs: Record<string, { primaryScheme: string | null }> = {};
  const providersByFeature: Record<string, { insuranceProviders: string[] }> = {};
  const nationalProviders = wire.insurance_providers
    .filter((provider) => provider.is_national)
    .map((provider) => provider.name);

  for (const row of wire.features) {
    features[row.feature] = row.is_enabled;
    featureConfigs[row.feature] = { primaryScheme: row.primary_scheme };

    if (row.feature === "DENTAL_INSURANCE") {
      providersByFeature[row.feature] = {
        insuranceProviders: wire.insurance_providers.map((p) => p.name),
      };
    }
  }

  return {
    code: wire.code,
    currency: wire.currency,
    currencySymbol: wire.currency_symbol,
    locale: wire.default_locale || wire.locale,
    geography: {
      subdivisionLabel: wire.geography.subdivision_label,
      subdivisionPlural: wire.geography.subdivision_label_plural,
      cityLabel: wire.geography.city_label,
    },
    features,
    featureConfigs,
    featureContexts: providersByFeature,
    insuranceProviders: nationalProviders,
    regions: wire.subdivisions.map(toSubdivision),
  };
}

/**
 * The config for one country.
 *
 * The API reads the country from the `Accept-Country` header, which `apiClient`
 * already sets from the region store, so no query parameter is needed. Pass
 * `countryCode` to preview another market without switching the region.
 */
export async function fetchCountryConfig(countryCode?: string): Promise<CountryConfig> {
  const wire = await getJson<CountryConfigWire>(
    `${API_BASE}/config/country`,
    countryCode ? { countryCode } : {},
  );

  return mapCountryConfig(wire);
}

/** Every active country, for the region switcher. */
export async function fetchCountries(): Promise<CountryListWire> {
  return getJson<CountryListWire>(`${API_BASE}/config/countries`);
}

/** A country's subdivisions, alphabetical. Empty for a country we do not serve. */
export async function fetchSubdivisions(countryCode: string): Promise<Subdivision[]> {
  const wire = await getJson<SubdivisionListWire>(`${API_BASE}/config/country/regions`, {
    query: { country: countryCode },
  });

  return wire.items.map(toSubdivision);
}

/** Specialties, in display order. The `code` is what a query string carries. */
export async function fetchSpecialties(): Promise<SpecialtyWire[]> {
  const wire = await getJson<SpecialtyListWire>(`${API_BASE}/config/specialties`);
  return wire.items;
}
