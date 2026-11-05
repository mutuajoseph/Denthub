import { type FormEvent, useEffect, useState } from "react";
import { useCountries } from "../../hooks/useCountries";
import { useUpdateMe } from "../../hooks/useMe";
import type { AuthUser } from "../../lib/auth";
import Button from "../ui/Button";
import Card from "../ui/Card";

type AccountDetailsSectionProps = {
  user: AuthUser;
  onUpdated: (user: AuthUser) => void;
};

function roleLabel(role: AuthUser["role"]): string {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Your account details could not be saved.";
}

export function AccountDetailsSection({ user, onUpdated }: AccountDetailsSectionProps) {
  const { countries } = useCountries();
  const updateMe = useUpdateMe(user.id);

  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [homeCountry, setHomeCountry] = useState(user.home_country_code ?? "");

  useEffect(() => {
    setFullName(user.full_name);
    setPhone(user.phone ?? "");
    setHomeCountry(user.home_country_code ?? "");
  }, [user.full_name, user.phone, user.home_country_code]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = fullName.trim();
    if (!name) return;

    updateMe.mutate(
      {
        full_name: name,
        phone: phone.trim() || null,
        home_country_code: homeCountry || null,
      },
      { onSuccess: (next) => onUpdated(next) },
    );
  };

  return (
    <Card tone="white" hover={false}>
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Account details
      </h2>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate">Email</dt>
          <dd className="mt-1 text-sm font-medium text-ink">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate">Account type</dt>
          <dd className="mt-1 text-sm font-medium text-ink">{roleLabel(user.role)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate">Status</dt>
          <dd className="mt-1 text-sm font-medium capitalize text-ink">{user.account_status}</dd>
        </div>
      </dl>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 border-t border-steel pt-5">
        <div>
          <label htmlFor="account-full-name" className="block text-xs font-medium text-slate">
            Name
          </label>
          <input
            id="account-full-name"
            type="text"
            maxLength={100}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-1 w-full rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-phone" className="block text-xs font-medium text-slate">
              Phone
            </label>
            <input
              id="account-phone"
              type="tel"
              maxLength={50}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label htmlFor="account-home-country" className="block text-xs font-medium text-slate">
              Home country
            </label>
            <select
              id="account-home-country"
              value={homeCountry}
              onChange={(event) => setHomeCountry(event.target.value)}
              className="mt-1 w-full rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">Not set</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {updateMe.isError && (
          <p role="alert" className="text-sm text-red-700">
            {describeError(updateMe.error)}
          </p>
        )}

        {updateMe.isSuccess && (
          <output className="text-sm text-emerald-800">Account details saved.</output>
        )}

        <div>
          <Button
            type="submit"
            size="sm"
            disabled={updateMe.isPending || fullName.trim().length === 0}
          >
            {updateMe.isPending ? "Saving…" : "Save details"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
