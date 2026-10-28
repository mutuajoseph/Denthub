# DentHub backend: API map

What the backend still needs to deliver [`PRD.md`](PRD.md), measured against
`main` at `6021227` (68 endpoints across 19 route modules). Built from a gap
analysis: anything `main` already does the agreed way is left out. Terms
follow [`CONTEXT.md`](../CONTEXT.md); the decisions behind the shape are
ADRs [0003](adr/0003-auth-token-storage-localstorage.md) to
[0009](adr/0009-health-record-access-is-by-care-grant.md).

This is a plan, not a contract. Each section becomes a parent issue with
PR-sized sub-issues; request and response models are settled in those issues,
and the Pydantic models remain the source of truth.

Each row is marked **New** (no such route), **Change** (the route exists
and its behaviour or shape changes), **Keep** (stays as is, listed for
context), or **Retire** (to be removed).

**Public (proposed)** marks a route outside the modules PRD §2 opens to
everyone; it stays role-gated until its issue confirms it public.

## Conventions

- **Base path** `/api/v1`; errors are `{ code, message, detail? }`; lists
  return `{ items, total, limit, offset }`. Message and notification feeds add
  an `?after=<cursor>` so they can move to SSE without a contract change.
- **Country.** Every catalogue and search request reads `Accept-Country` /
  `Accept-Currency`; an explicit `country` query parameter overrides the header
  (as `/facilities` and `/dentists` already do). No FX conversion.
- **Disabled modules** return `503`, as Jobs and Training already do
  ([`training.py`](../backend/app/logic/v1/training.py)), so the UI can say
  "not available here". The Shop and insurance flags must start being enforced.
- **Tokens.** Public and staff tokens share the `users` table and secret,
  told apart by `scope` and `iss` (ADR-0004). Every staff route checks
  `scope == "staff"`; every public route rejects it.
- **Acting as.** Facility work goes through `/facilities/{facility_id}/...`
  with a membership check; a Profile's own work goes through the module's
  existing `/me` path (`/suppliers/me`, `/training/me`, new `/dentists/me`);
  User-level settings go through `/me`. Never a header.
- **Expiry at read time.** Care Grants, Quotes, and Invitations store
  `expires_at`; status is derived on read through one repository-level "live"
  filter. Nothing runs on a timer in MVP.

### Who-can-call shorthand

| Code | Means |
|---|---|
| Public | No token |
| User | Any public-scope token |
| Patient / Specialist / Supplier / TP | User holding that Profile (TP = Training Provider) |
| VM | Verified Medic: a Specialist, or a Facility member acting for it, at tier verified or featured |
| FM:`perm` | Facility member with that permission: `owner`, `front_office`, `clinical` |
| CG | Clinician holding a live Care Grant for that Patient |
| Op:`Division` | Operator in that Division (read); **(L)** = Lead, needed for writes (ADR-0005) |
| Admin / Super | Platform Admin / Super Admin, staff-scope token |

Each issue re-confirms its roles before the route is built (AGENTS.md: new
routes are role-gated and the roles are the user's call).

---

## Bugs on `main` (fix first, each its own `fix:` issue, test red first)

1. **A Specialist Appointment can never be confirmed** (#113). It is stored with
   `facility_id = NULL`, and the only confirm path requires the caller's
   Facility to match
   ([`facility.py:174`](../backend/app/logic/v1/facility.py)). The interim fix
   lets the booked Specialist's linked account confirm it; the structural fix
   is ADR-0008 (P1).
2. **`POST /users/{id}/approve` accepts a public-scope token and writes no
   audit row** (#114) ([`users.py`](../backend/app/logic/v1/users.py)), unlike every
   `/admin` route. Require a staff token, and audit it.

---

## P0 Foundation

### Cross-cutting logic

| Piece | Status | What it does |
|---|---|---|
| Auth dependencies | New | Today each route passes a raw token into logic and re-implements its gate. Add `current_user`, `current_staff`, `require_profile(kind)`, `require_verified()`, `require_facility_permission(perm)`, `require_care_grant()` as FastAPI dependencies |
| `iss` check | Change | Verify `iss` on decode, not just `scope` (ADR-0004 left it unenforced) |
| Audit log | Change | `admin_audit_log` exists for admin writes. Extend it (or add a sibling table) to Health Record reads and writes, Care Grant changes, and Verification decisions |
| `Mailer` | New | Interface, console mailer locally, provider (Resend/Postmark) in production |
| `Storage` | New | Presigned PUT/GET on S3-compatible storage, public and private buckets (ADR-0007) |

### Accounts and Profiles (ADR-0006)

Expand, migrate, contract. Step 1 adds Profile and membership tables and
backfills them from `users.role` / `users.facility_id`, keeping both columns.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/auth/register` | Change | Public | Same `account_type` allowlist; now creates the User plus its first Profile, or a Facility, first Branch, and owner membership |
| GET | `/auth/me` | Change | User | Adds `profiles` and `memberships`; keeps a derived `role` until the frontend migrates |
| GET, PATCH | `/me` | New | User | Name, phone, home Country |
| POST | `/me/profiles` | New | User | Add a Profile kind the User lacks |
| GET, POST, PATCH | `/dentists/me` | New | Specialist | Own Specialist Listing: bio, Specialties, Workplaces, avatar key |
| POST | `/dentists/me/practice` | New | Specialist | Solo onboarding: one-Branch Facility plus owner and clinical membership (ADR-0008) |
| GET | `/me/memberships` | New | User | Facilities and permission sets |
| GET | `/me/export` | New | User | JSON export (Profiles, Health Record, Appointments, messages), built in the request |
| DELETE | `/me` | New | User | Deletion request; identity data removed, clinician-written Clinical Entries kept detached for the configurable retention period |

### Sessions (ADR-0003's follow-up, now due)

ADR-0003 deferred the refresh cookie "before allowing sensitive operations";
Health Records are live, so that point has passed.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/auth/login`, `/auth/staff/login` | Change | Public | Access JWT drops from 7 days to 15 minutes, plus a rotating refresh cookie (httpOnly, Secure, SameSite=Lax; separate cookie path for staff) |
| POST | `/auth/refresh` · `/auth/staff/refresh` | New | Cookie | Rotate; reuse of a rotated token revokes the family |
| POST | `/auth/logout` · `/auth/staff/logout` | New | User · Staff | Revoke |
| POST | `/auth/verify-email` · `/auth/verify-email/resend` | New | Public · User | Email ownership |
| POST | `/auth/password/forgot` · `/auth/password/reset` | New | Public | Emailed single-use token; reset revokes refresh tokens |
| POST | `/auth/password/change` | New | User | Requires the current password |

### Platform Staff

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET, POST | `/admin/staff` | New | Super | List and create staff (sets `platform_role`, and Division and tier for Operators). Today this needs a database write (ADR-0005) |
| PATCH | `/admin/staff/{id}` | New | Super | Change role, Division, tier, active |
| GET | `/admin/users[/{id}]` | New | Admin | Search Users with Profiles and memberships |
| POST | `/admin/users/{id}/suspend` · `/reactivate` | New | Admin | `account_status` becomes `active \| suspended`; suspension revokes refresh tokens |
| POST | `/users/{id}/approve` | Retire | — | Retired once Verification lands; professional "pending" is read from Verification instead |

### Uploads

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/uploads` | New | User | `{ purpose, content_type, size }` returns a presigned PUT and key. Purpose picks the bucket and the permission check |

### Verification (applications behind the existing tier)

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/verifications` | New | Specialist · FM:owner · Supplier · TP | Licence or registration number, issuing body, document keys → PENDING |
| GET | `/me/verifications` | New | User | Status per subject, with rejection reason |
| GET | `/admin/verifications` | Change | Admin | Today lists tiers; add the application queue for all four subject kinds |
| POST | `/admin/verifications/{id}/approve` · `/reject` · `/revoke` | New | Admin | Approve sets the tier to `verified`; reject and revoke need a reason; audited and emailed |
| GET | `/operations/verifications` | New | Op:Dentist · Op:Suppliers · Op:Training | Division-scoped queue (Specialist and Facility → Dentist, Supplier → Suppliers, TP → Training) |
| POST | `/operations/verifications/{id}/approve` · `/reject` · `/revoke` | New | Op (L) | Same decisions, Division-scoped |
| PATCH | `/admin/{facilities,specialists}/{id}/verification-tier` | Keep | Admin | Still sets `basic` and `featured` directly |

### Reference data

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET | `/config/treatments` | New | Public (proposed) | Platform-wide treatment list for Services |
| CRUD | `/admin/specialties` · `/admin/treatments` · `/admin/countries/{code}/insurance-providers` · `/subdivisions` | New | Admin | Reference-data editing |

---

## P1 Booking wedge

### Facilities, Branches, and members

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET | `/facilities/{id}` | Change | Public | Add Services, accepted insurers, real rating |
| PATCH | `/facilities/{id}` | New | FM:owner | Name, description, logo |
| POST, PATCH, DELETE | `/facilities/{id}/branches[/{bid}]` | New | FM:owner | Address, Subdivision, phones, `timezone` (defaults to the Country's), `accepts_emergencies` |
| PUT | `.../branches/{bid}/hours` | New | FM:owner | Weekly Opening Hours (table exists) plus new date overrides |
| PUT | `.../branches/{bid}/services` · `/insurance` | New | FM:owner | Services (treatment plus `price_from`) and accepted insurers |
| GET | `/facilities/{id}/members` | New | FM:any | Members and permission sets |
| POST, DELETE | `/facilities/{id}/invitations[/{iid}]` | New | FM:owner | Emailed Invitation, 7-day expiry |
| POST | `/invitations/{token}/accept` | New | Public (proposed; the token is the credential) | Creates the User if new, then the membership |
| PATCH, DELETE | `/facilities/{id}/members/{user_id}` | New | FM:owner | Change or remove; the last owner cannot be removed or demoted |
| GET | `/facilities/{id}/dashboard` | Change | FM:any | Moves from `/facility/dashboard` (which reads `users.facility_id`) |
| GET | `/facilities/{id}/patients` | New | FM:front_office · FM:clinical | Patients with Appointments here, contact details only |

### Find a Dentist

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET | `/facilities` · `/dentists` | Change | Public | Add filters: `insurance`, `treatment` plus `max_price`, `open_now`, `min_rating`. Today only Subdivision, tier, and Specialty |
| GET | `/branches/{id}` | New | Public (proposed) | Hours, Services, insurance, open now |

### Appointments (ADR-0008)

One transition table owns the state machine; illegal moves are `400`, as
today.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/appointments` | Change | Patient | Body takes `branch_id`, optional `specialist_id` and `treatment_id`. Migration backfills `branch_id` for existing rows |
| GET | `/appointments` | Keep | Patient | Own Appointments |
| PATCH | `/appointments/{id}` | Change | Patient | Today cancel or reschedule; add accepting the Facility's proposed time |
| GET | `/dentists/me/appointments` | New | Specialist | Appointments naming them, across Facilities |
| GET | `/facilities/{id}/appointments` | New | FM:front_office · FM:clinical | Filter by Branch, status, date |
| PATCH | `/facilities/{id}/appointments/{aid}` | Change | FM:front_office · FM:clinical | Moves from `/facility/appointments/{id}`. Adds DECLINED, NO_SHOW, propose-a-time, and assigning the Specialist. COMPLETED needs `clinical`. CONFIRMED creates the Care Grant |

### Health Record (ADR-0009)

Every route writes an audit event.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET | `/health-records/{patient_id}` | Change | Patient (own) · CG | Gate moves from "my Facility had an Appointment" to a live Care Grant; reads are now audited |
| PATCH | `/health-records/{patient_id}` | Change | Patient (own) · CG | Add current-state fields (allergies, medications, blood type) and Maternal Status expected date, with change history |
| POST | `/health-records/{patient_id}/entries` | Change | Patient (own) · CG | Unchanged shape; gate as above |
| POST | `.../entries/{eid}/amendments` | New | CG (entry author) | Amendment linked to the original |
| GET | `/health-records/{patient_id}/history` · `/access-log` | New | Patient (own) | Field history; who read or wrote and when |
| GET, POST | `/health-records/{patient_id}/care-grants` | New | Patient (own) | List; share explicitly with a Verified Medic |
| DELETE | `.../care-grants/{gid}` | New | Patient (own) | Revoke |
| GET | `/dentists/me/patients` | New | VM | Patients with live Care Grants |

### Reviews

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/appointments/{id}/review` | New | Patient | After COMPLETED, once per Appointment; rates the Branch (and Specialist). Replaces the seeded `rating` / `review_count` with maintained aggregates |
| GET | `/branches/{id}/reviews` · `/dentists/{id}/reviews` | New | Public (proposed) | Visible Reviews with replies |
| POST | `/facilities/{id}/reviews/{rid}/reply` | New | FM:owner | One public reply |
| PATCH | `/admin/moderation/reviews/{id}` · `/operations/reviews/{id}` | New | Admin · Op:Dentist (L) | Hide or unhide; recomputes the aggregate |

### Emergency

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET | `/emergency` | New | Public (proposed) | Branches with `accepts_emergencies` open now, plus On Call clinicians with the Branch's emergency phone |
| PUT, DELETE | `/facilities/{id}/branches/{bid}/on-call` | New | FM:clinical (self) | Declare or end On Call until a time |

### International: Consultation Requests and Quotes

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/consultation-requests` | New | Patient | To a Facility: description, attachment keys, travel dates; opens a Conversation |
| GET | `/consultation-requests[/{id}]` | New | Patient | Own requests with Quotes |
| GET, PATCH | `/facilities/{id}/consultation-requests[/{cid}]` | New | FM:owner · FM:clinical | Inbox; attach an external meeting link; close |
| POST | `.../consultation-requests/{cid}/quotes` | New | FM:owner · FM:clinical | Line items in the Branch currency, `valid_until` → SENT |
| POST | `/quotes/{qid}/accept` · `/decline` | New | Patient | Accept returns a prefilled Appointment request |
| GET | `/operations/consultation-requests` | New | Op:International | Support view |

---

## P2 Shop and Suppliers

Wholesale Price stays quantity-based for everyone, as PRD §3.4 and `main`
have it. Suppliers keep one Country and the local/international `scope`.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET | `/products` · `/products/{id}` · `/products/categories` | Change | Public | Enforce `ORAL_CARE_SHOP` (503). Rename `dentist_recommended` to a Shop-curated badge |
| GET | `/suppliers` · `/suppliers/{slug}` | New | Public (proposed) | Supplier directory and storefront (only `/suppliers/me` exists). Browsing public, acting needs a Verified Medic (`CONTEXT.md`), which answers PRD §8 Q1 against PRD §2's table; confirm in the issue |
| PATCH | `/suppliers/me` | New | Supplier | Edit the store (only create exists) |
| PATCH | `/operations/products/{id}` | New | Op:Shop (L) | Hide, unhide, set the badge |
| POST | `/orders` | New | Patient (Retail) · VM (Bulk) | `{ supplier_id, lines }`, priced per line at its quantity tier and snapshotted → SUBMITTED; opens a Conversation |
| POST | `/facilities/{id}/orders` | New | FM:owner | Bulk Order for the Facility |
| GET | `/orders` · `/facilities/{id}/orders` · `/suppliers/me/orders` | New | Buyer · FM:owner · Supplier | Own Orders |
| POST | `/orders/{id}/quote` · `/accept` · `/fulfil` · `/cancel` | New | Supplier · Buyer · Supplier · either | Transitions |
| GET | `/operations/orders` | New | Op:Shop | Disputes and support |
| POST | `/health-records/{patient_id}/product-recommendations` | New | CG | Products plus a note; notifies the Patient |
| GET | `/me/product-recommendations` | New | Patient | "Recommended for you" |

---

## P3 Messaging and notifications

Messages exist as one thread per pair of Users with a `kind` enum. They move to
Parties so a Facility's inbox is shared by its members.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET, POST | `/messages/conversations` | Change | User | Own Profiles' Conversations; open one with `{ to_party, subject?, body }`. `kind` becomes derived from the two Parties. Gating per pair (messaging a Supplier needs VM) |
| GET, POST | `/facilities/{id}/conversations` | New | FM:any | The Facility's shared inbox |
| GET | `/messages/conversations/{id}` | Change | Party member | Add `?after=` cursor |
| POST | `/messages/conversations/{id}/messages` · `/read` | Change | Party member | Read markers per User, not per side |
| GET | `/me/notifications?after=` · `/me/notifications/unread-count` | New | User | In-app feed |
| POST | `/me/notifications/read` | New | User | `{ ids }` or `{ all: true }` |

Emails: Appointment confirmed, declined, cancelled, or rescheduled;
Verification decision; Order quoted; Quote issued; new Job Application; new
message, only if the Party has unread messages and was not emailed in the last
hour (checked at send time).

**Deferred:** WebRTC calls; signaling will hang off
`/messages/conversations/{id}/calls`.

---

## P4 Jobs, training, magazine

### Jobs

Postings exist (seeded, Branch-linked, moderated). Posting and applying do not.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST, PATCH | `/facilities/{id}/jobs[/{jid}]` | New | FM:owner | Post at one of the Facility's Branches, recording the posting member; close |
| POST | `/jobs/{id}/applications` | New | Specialist | Cover note plus optional CV key → SUBMITTED |
| GET | `/me/job-applications` · PATCH `.../{aid}` | New | Specialist | Own applications; withdraw |
| GET, PATCH | `/facilities/{id}/jobs/{jid}/applications[/{aid}]` | New | FM:owner | Shortlist, reject, hire |

### Training and CPD

The catalogue and provider CRUD exist. Enquiries, Enrolments, and
certificates do not.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| POST | `/training/courses/{id}/enquiries` | New | VM | Opens a Conversation |
| POST | `/training/courses/{id}/enrolments` | New | VM | Enrolment, no payment |
| GET | `/training/me/enrolments` | New | TP | Enrolment inbox |
| POST | `/training/me/enrolments/{id}/complete` | New | TP | Issues the CPD Certificate (points, verification code) |
| GET | `/me/enrolments` · `/me/cpd-certificates` | New | VM | Own |
| GET | `/cpd-certificates/verify/{code}` | New | Public (proposed) | Verification |
| PATCH | `/operations/courses/{id}` | New | Op:Training (L) | Take down |

### Magazine

Articles exist (seeded, `author_name` as a string, `published | hidden`).
Submission does not.

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET, POST, PATCH | `/me/magazine-items[/{id}]` | New | VM | DRAFT CRUD; author becomes a User link |
| POST | `/me/magazine-items/{id}/submit` | New | VM | → SUBMITTED. Videos must pass the YouTube Data API check (`contentDetails.definition == "hd"`), otherwise `422`. New secret `YOUTUBE_API_KEY` |
| PATCH | `/admin/moderation/magazine/{id}` | Change | Admin | Add `submitted → published \| rejected` and `is_featured` |
| GET, PATCH | `/operations/magazine[/{id}]` | New | Op:Dentist (L for writes) | Same queue, Division-scoped |

---

## P5 Console

| Method | Path | Status | Who | Logic |
|---|---|---|---|---|
| GET | `/operations/queue` | New | Op | Pending items in the Operator's Division, across modules |
| GET | `/admin/deletion-requests` · POST `.../{id}/complete` | New | Admin | Deletions actioned within 30 days |

**Out of scope:** Site CMS (client-side), the Dr. Denta chatbot (client-side),
paid emergency triage, payments, SMS, Supplier ships-to lists, Supplier and
Training Provider job posting, and the PRD §7 AI features.

---

## Contract changes the frontend must absorb

- `/auth/me` moves from `role` to Profiles and memberships in three PRs:
  expand (backend adds fields, keeps a derived `role`, TS types gain the
  fields), migrate (`RouteGuard.tsx`, `Navbar.tsx`, `roles.ts` switch over),
  contract (`role` leaves the response, `users.role` narrows to
  `platform_role`).
- `/facility/*` moves to `/facilities/{id}/*`.
- Appointment requests take `branch_id`.
- Access tokens become short-lived with a refresh cookie (ADR-0003 follow-up).
- Conversations move from `recipient_id` to Parties.
- `products.dentist_recommended` is renamed.

## New secrets (add to `render.yaml` and `docs/RELEASE.md`)

Object storage credentials and bucket names, the mail provider API key,
`YOUTUBE_API_KEY`, and the refresh-token signing secret.
