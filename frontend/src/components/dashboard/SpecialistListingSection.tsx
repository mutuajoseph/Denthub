import { type FormEvent, useEffect, useState } from "react";
import { useActiveCountryCode } from "../../hooks/useActiveCountryCode";
import { useCountries } from "../../hooks/useCountries";
import { useCountrySubdivisions } from "../../hooks/useCountrySubdivisions";
import {
  useCreateMySpecialist,
  useMySpecialist,
  useUpdateMySpecialist,
} from "../../hooks/useDentistMe";
import { useListingDetail } from "../../hooks/useListingDetail";
import { useListingSearch } from "../../hooks/useListingSearch";
import { useSpecialties } from "../../hooks/useSpecialties";
import { ApiError } from "../../lib/apiClient";
import type { AuthUser } from "../../lib/auth";
import type { MySpecialist } from "../../lib/dentistMeApi";
import type { BranchView } from "../../lib/listingApi";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";

const fieldClass =
  "mt-1 w-full rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink";
const labelClass = "block text-xs font-medium text-slate";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Your Specialist listing could not be saved.";
}

function hasSpecialistProfile(user: AuthUser): boolean {
  return user.profiles.some((profile) => profile.kind === "specialist");
}

type SpecialistFieldsProps = {
  idPrefix: string;
  name: string;
  onNameChange: (value: string) => void;
  countryCode: string;
  onCountryChange: (value: string) => void;
  subdivisionCode: string;
  onSubdivisionChange: (value: string) => void;
  bio: string;
  onBioChange: (value: string) => void;
  specialtyCodes: string[];
  onToggleSpecialty: (code: string) => void;
};

function SpecialistFields({
  idPrefix,
  name,
  onNameChange,
  countryCode,
  onCountryChange,
  subdivisionCode,
  onSubdivisionChange,
  bio,
  onBioChange,
  specialtyCodes,
  onToggleSpecialty,
}: SpecialistFieldsProps) {
  const { countries } = useCountries();
  const countryConfig = useCountrySubdivisions(countryCode || null);
  const { options: specialties } = useSpecialties();
  const subdivisions = countryConfig.data?.regions ?? [];
  const subdivisionLabel = countryConfig.data?.geography.subdivisionLabel ?? "Subdivision";

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-name`} className={labelClass}>
          Listing name
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          maxLength={150}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-country`} className={labelClass}>
            Country
          </label>
          <select
            id={`${idPrefix}-country`}
            value={countryCode}
            onChange={(event) => {
              onCountryChange(event.target.value);
              onSubdivisionChange("");
            }}
            className={fieldClass}
          >
            <option value="">Choose a country</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-subdivision`} className={labelClass}>
            {subdivisionLabel}
          </label>
          <select
            id={`${idPrefix}-subdivision`}
            value={subdivisionCode}
            onChange={(event) => onSubdivisionChange(event.target.value)}
            disabled={countryCode === "" || countryConfig.isPending}
            className={fieldClass}
          >
            <option value="">
              {countryCode === "" || countryConfig.isPending ? "Choose a country first" : "Choose"}
            </option>
            {subdivisions.map((subdivision) => (
              <option key={subdivision.code} value={subdivision.code}>
                {subdivision.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-bio`} className={labelClass}>
          Bio
        </label>
        <textarea
          id={`${idPrefix}-bio`}
          rows={4}
          maxLength={4000}
          value={bio}
          onChange={(event) => onBioChange(event.target.value)}
          className={fieldClass}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Specialties</legend>
        {specialties.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No specialties are configured yet.</p>
        ) : (
          <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-button border border-steel bg-paper p-3 sm:grid-cols-2">
            {specialties.map((specialty) => (
              <label key={specialty.code} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={specialtyCodes.includes(specialty.code)}
                  onChange={() => onToggleSpecialty(specialty.code)}
                  className="h-4 w-4"
                />
                {specialty.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}

function CreateListingForm({ user }: { user: AuthUser }) {
  const activeCountry = useActiveCountryCode();
  const createListing = useCreateMySpecialist(user.id);

  const [name, setName] = useState(user.full_name);
  const [countryCode, setCountryCode] = useState(user.home_country_code ?? activeCountry);
  const [subdivisionCode, setSubdivisionCode] = useState("");
  const [bio, setBio] = useState("");
  const [specialtyCodes, setSpecialtyCodes] = useState<string[]>([]);

  const toggleSpecialty = (code: string) => {
    setSpecialtyCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    createListing.mutate({
      name: name.trim() || undefined,
      country_code: countryCode,
      subdivision_code: subdivisionCode,
      bio: bio.trim() || null,
      specialty_codes: specialtyCodes,
      branch_ids: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
      <p className="text-sm text-slate">
        Create the public profile patients see. You can add workplaces after it is created.
      </p>

      <SpecialistFields
        idPrefix="specialist-create"
        name={name}
        onNameChange={setName}
        countryCode={countryCode}
        onCountryChange={setCountryCode}
        subdivisionCode={subdivisionCode}
        onSubdivisionChange={setSubdivisionCode}
        bio={bio}
        onBioChange={setBio}
        specialtyCodes={specialtyCodes}
        onToggleSpecialty={toggleSpecialty}
      />

      {createListing.isError && (
        <p role="alert" className="text-sm text-red-700">
          {describeError(createListing.error)}
        </p>
      )}

      <div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={createListing.isPending || countryCode === "" || subdivisionCode === ""}
        >
          {createListing.isPending ? "Creating…" : "Create listing"}
        </Button>
      </div>
    </form>
  );
}

function EditListingForm({ user, listing }: { user: AuthUser; listing: MySpecialist }) {
  const activeCountry = useActiveCountryCode();
  const updateListing = useUpdateMySpecialist(user.id);

  const [name, setName] = useState(listing.name);
  const [countryCode, setCountryCode] = useState(listing.countryCode);
  const [subdivisionCode, setSubdivisionCode] = useState(listing.subdivisionCode);
  const [bio, setBio] = useState(listing.bio ?? "");
  const [specialtyCodes, setSpecialtyCodes] = useState(
    listing.specialties.map((specialty) => specialty.code),
  );
  const [branchIds, setBranchIds] = useState(listing.branches.map((branch) => branch.id));
  const [extraBranches, setExtraBranches] = useState<BranchView[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [newBranchId, setNewBranchId] = useState("");

  const facilityListings = useListingSearch({
    country: countryCode || activeCountry,
    listingType: "facility",
  });
  const facilityDetail = useListingDetail("facility", facilityId);

  useEffect(() => {
    setName(listing.name);
    setCountryCode(listing.countryCode);
    setSubdivisionCode(listing.subdivisionCode);
    setBio(listing.bio ?? "");
    setSpecialtyCodes(listing.specialties.map((specialty) => specialty.code));
    setBranchIds(listing.branches.map((branch) => branch.id));
    setExtraBranches([]);
    setFacilityId("");
    setNewBranchId("");
  }, [listing]);

  const knownBranches = new Map(
    [...listing.branches, ...extraBranches].map((branch) => [branch.id, branch]),
  );
  const availableBranches = (facilityDetail.profile?.branches ?? []).filter(
    (branch) => !branchIds.includes(branch.id),
  );

  const toggleSpecialty = (code: string) => {
    setSpecialtyCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  const changeCountry = (value: string) => {
    setCountryCode(value);
    setBranchIds([]);
    setExtraBranches([]);
    setFacilityId("");
    setNewBranchId("");
  };

  const addBranch = () => {
    const branch = availableBranches.find((row) => row.id === newBranchId);
    if (!branch) return;

    setExtraBranches((current) => [...current, branch]);
    setBranchIds((current) => [...current, branch.id]);
    setNewBranchId("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    updateListing.mutate({
      name: name.trim(),
      country_code: countryCode,
      subdivision_code: subdivisionCode,
      bio: bio.trim() || null,
      specialty_codes: specialtyCodes,
      branch_ids: branchIds,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
      <SpecialistFields
        idPrefix="specialist-edit"
        name={name}
        onNameChange={setName}
        countryCode={countryCode}
        onCountryChange={changeCountry}
        subdivisionCode={subdivisionCode}
        onSubdivisionChange={setSubdivisionCode}
        bio={bio}
        onBioChange={setBio}
        specialtyCodes={specialtyCodes}
        onToggleSpecialty={toggleSpecialty}
      />

      <fieldset>
        <legend className={labelClass}>Workplaces</legend>
        {branchIds.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No workplaces selected.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {branchIds.map((branchId) => {
              const branch = knownBranches.get(branchId);
              const label = branch
                ? `${branch.facilityName}${branch.name ? ` — ${branch.name}` : ""}`
                : "Selected workplace";

              return (
                <li
                  key={branchId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-button border border-steel bg-paper px-3 py-2"
                >
                  <span className="text-sm text-ink">{label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setBranchIds((current) => current.filter((item) => item !== branchId))
                    }
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 grid gap-3 rounded-button border border-steel bg-cloud p-3 sm:grid-cols-2">
          <div>
            <label htmlFor="specialist-facility" className={labelClass}>
              Facility
            </label>
            <select
              id="specialist-facility"
              value={facilityId}
              onChange={(event) => {
                setFacilityId(event.target.value);
                setNewBranchId("");
              }}
              className={fieldClass}
            >
              <option value="">
                {facilityListings.isLoading ? "Loading facilities…" : "Choose a facility"}
              </option>
              {facilityListings.listings.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="specialist-branch" className={labelClass}>
              Branch
            </label>
            <select
              id="specialist-branch"
              value={newBranchId}
              onChange={(event) => setNewBranchId(event.target.value)}
              disabled={facilityId === "" || facilityDetail.isLoading}
              className={fieldClass}
            >
              <option value="">
                {facilityId === "" || facilityDetail.isLoading
                  ? "Choose a facility first"
                  : "Choose a branch"}
              </option>
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name ?? branch.address}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={newBranchId === ""}
              onClick={addBranch}
            >
              Add workplace
            </Button>
          </div>
        </div>

        {facilityListings.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {describeError(facilityListings.error)}
          </p>
        )}
        {facilityDetail.error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {describeError(facilityDetail.error)}
          </p>
        )}
      </fieldset>

      {updateListing.isError && (
        <p role="alert" className="text-sm text-red-700">
          {describeError(updateListing.error)}
        </p>
      )}

      {updateListing.isSuccess && (
        <output className="text-sm text-emerald-800">Specialist listing saved.</output>
      )}

      <div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={updateListing.isPending || name.trim().length === 0 || subdivisionCode === ""}
        >
          {updateListing.isPending ? "Saving…" : "Save listing"}
        </Button>
      </div>
    </form>
  );
}

export function SpecialistListingSection({ user }: { user: AuthUser }) {
  const qualified = hasSpecialistProfile(user);
  const listing = useMySpecialist(user.id, qualified);

  if (!qualified) {
    return null;
  }

  const notFound = listing.error instanceof ApiError && listing.error.status === 404;

  return (
    <Card tone="white" hover={false}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
          Specialist listing
        </h2>
        {listing.data && <Badge variant="neutral">{listing.data.verificationTier}</Badge>}
      </div>

      {listing.isPending ? (
        <output className="mt-3 block text-sm text-slate">Loading your Specialist listing…</output>
      ) : listing.error && !notFound ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-red-700">
            {describeError(listing.error)}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => void listing.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : notFound ? (
        <CreateListingForm user={user} />
      ) : listing.data ? (
        <EditListingForm user={user} listing={listing.data} />
      ) : null}
    </Card>
  );
}
