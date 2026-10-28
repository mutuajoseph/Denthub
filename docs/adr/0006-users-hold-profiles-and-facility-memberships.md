# A User holds Profiles and Facility Memberships, not a single role

Today a user has one `users.role` and at most one `users.facility_id`. Real
people don't fit that: a dentist works shifts at two clinics, a Facility owner
is often a dentist too, and a Specialist with no `facility_id` can never be
reached by facility-scoped logic (a Specialist Appointment cannot be
confirmed, and a solo Specialist never qualifies for Health Record access). We
separate the login (User) from what it acts as: a User holds at most one
Profile of each kind (Patient, Specialist, Supplier, Training Provider) and any
number of Facility Memberships, each with its own permission set (owner, Front
Office, clinical). The Account Type chosen at signup creates the first Profile,
or a Facility plus an owner membership.

## Consequences

- Facility-scoped routes name the Facility in the path
  (`/facilities/{facility_id}/...`) and check the caller's membership on every
  request; `/facility/...` routes that read `users.facility_id` move there.
- `users.facility_id` and the public values of `users.role` are retired by
  expand, migrate, contract. `users.role` narrows to a nullable
  `platform_role` that only Platform Staff carry, so ADR-0004 (staff token
  scope) and ADR-0005 (Operator columns on the user row) still hold.
- `/auth/me` gains `profiles` and `memberships` while still returning a
  derived `role`, until the frontend has migrated off it.
