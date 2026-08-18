# DentHub — Product Requirements Document (v0.1 draft)

*Derived from a read of the existing frontend repo ([Wangechi-Muturi/DENTHUB-PROJECT](https://github.com/Wangechi-Muturi/DENTHUB-PROJECT)), the project's own pitch deck, and the founder's Excalidraw planning notes. This is a "reverse-engineered" PRD — it names what the UI already assumes exists (plus what the whiteboard says is still intended), so it can drive backend/system design, not a from-scratch product spec.*

---

## 1. One-liner

A multi-sided marketplace connecting **patients**, **dental facilities/dentists**, **oral-care suppliers**, **training providers**, and **job seekers/employers** in the dental industry — Kenya-first, designed to expand to other countries (Nigeria is next, config already stubbed for GB/US/AE/ZA/IN/TR).

The pitch deck frames it as "LinkedIn + Booking.com + Uber + Health Records — for dentistry." Treat that as north-star vision; the **built MVP is narrower** (see §3 vs §7).

## 2. Users & roles

The frontend already encodes a full RBAC model — this is effectively free requirements:

| Role | Access |
|---|---|
| **Patient** (incl. international patient) | Find dentists, book, own health record, shop, message |
| **Dentist / Specialist / Intern** | Clinical tools (charts, prescriptions), publish magazine content, course enquiries |
| **Facility owner (clinic employer)** | Manages a facility, staff, sees facility-wide stats |
| **Front office / reception** (facility sub-role) | Appointments/check-in only — explicitly **no** chart access |
| **Facility dentist/specialist** (facility sub-role) | Full clinical access, scoped to that facility |
| **Supplier** (local or international) | Storefront, wholesale product catalog, messaging |
| **Training provider** | Course catalog, enrollment/enquiry inbox |
| **Platform admin / Super admin** | Full `/admin` console: countries, feature flags, users, clinic verification, moderation, shop admin |
| **Platform operator** | Scoped to one division (Jobs, Shop, Training, Dentist, International, Suppliers) with tier (Lead/Assistant), works from `/operations` |

Staff (admin/operator) sign in via a **separate, unlinked route** (`/staff/access`), distinct from the public login modal — deliberate separation of client-facing and internal auth. Carry this into system design as two auth surfaces, possibly two token scopes.

**From the founder's whiteboard**, the professional side has exactly two top-level account types at signup: **Facility/Dental Facility** and **Specialist** (individual dentist). Both get access to the same module set — patients directory, international patients (with health history access), job board, oral-care shop, skills & CPD, suppliers (local + international), and magazine/content creation. This is a cleaner mental model than the code's finer-grained roles (facility owner vs. front-office vs. facility dentist vs. independent dentist) — treat the whiteboard's two-type split as the account-creation model, and the code's finer roles as *permissions within* the Facility account (a facility has staff members with different clinical/front-office permissions).

Every professional profile (facility or specialist) should surface: **insurances accepted, reviews, and branches** (if the facility has more than one location). **Branches aren't in the current mock data model** (`mockDentists.js` has a single county/town per listing) — flag this as a real schema gap: a facility needs a one-to-many branch/location relationship, not a flat address field.

**Access tiers by module** (per whiteboard, not fully matched by current routing — see §8):
| Module | Who can access |
|---|---|
| Oral-care shop, dental magazine, jobs board | Any user, no registration required |
| CPD & training, suppliers (local/international) | Only users registered as a verified medic |

## 3. Core features (what's actually built in the UI)

1. **Find a Dentist** — search individual specialists and clinics/practices by region, specialty, insurance/NHIF, open-now, rating, price; dentist profile pages with a "Book Appointment" CTA. Whiteboard confirms the core filter set as **insurance, speciality, country, county** — country as an explicit filter reinforces that cross-border search (not just single-country) is intended from the start.
2. **Facility operations** — dashboard with stats (today's appointments, pending, staff), an appointments workflow (`PENDING → CONFIRMED → IN_PROGRESS → COMPLETED`), and patient chart management (history, prescriptions, allergies, medications) gated separately from front-office/check-in access.
3. **Patient health record** — patient-owned record (allergies, medications, blood type, etc.), readable/writable by both patient and treating clinician, with an author badge distinguishing who entered each note. **Per the whiteboard**, this is explicitly a portability model: the patient owns the record, but *any verified doctor* — not just staff at one facility — can write to it once the patient is under their care. Fields called out specifically: medical history, dental history, prescriptions, allergies, and a maternal-status flag (lactating/pregnant) — the last one isn't in the current code and should be added to the data model.
4. **Oral-care shop** — product catalog with **retail vs. wholesale pricing** (auto wholesale discount at 12+ qty), cart, and a message-the-shop bulk-order flow instead of classic checkout. The whiteboard adds a specific workflow the code hints at (`dentistRecommended` flag) but doesn't fully wire up: a treating dentist can **recommend specific products directly to a patient**, separate from a facility placing a bulk supply order — two distinct flows sharing one product catalog.
5. **Suppliers marketplace** — supplier directory + individual storefronts (local/international), supplier-managed categories/products.
6. **Jobs board** — filterable job postings (type, region, salary range), login-gated "Apply," stubbed "Post a Job."
7. **Training/courses** — course catalog + webinars, CPD certificate concept, provider dashboard with enrollment/enquiry stats.
8. **Magazine** — articles + videos, any verified professional role can publish; video submissions require a YouTube link and pass an automated HD check.
9. **Messaging + calls** — one inbox spanning every cross-role conversation type (patient↔facility, patient↔dentist, dentist↔supplier, patient↔shop, clinic↔shop bulk, dentist↔training), plus WebRTC voice/video with REST-based signaling and polling.
10. **Chatbot ("Dr. Denta")** — offline/rule-based dental Q&A widget, escalates to `/emergency` on urgent symptoms, fixed medical disclaimer.
11. **Emergency page** — open clinics + on-call dentists (`tel:` links), a triage textarea (stubbed as paid).
12. **Multi-country config / "dental tourism"** — per-country currency, subdivision label (county/state/province), feature flags (insurance, shop, jobs on/off per market). Whiteboard frames the international-patient flow specifically as **teleconsultation to get a quotation and understand requirements** before traveling — a pre-booking consult-and-quote step, not just marketing content.
13. **Admin/Ops consoles** — platform admin (countries, feature flags, clinic verification, moderation) plus a client-side "Site CMS" (page content stored in `localStorage`, export/import as JSON — a placeholder, not a real CMS backend) and a division-scoped operations console.

## 4. Data entities (from mock data + API module shapes)

These map closely to eventual DB tables:

- **User** (role/apiRole, region, auth fields)
- **Dentist/Specialist/Practice** — specialty[], county/town, rating, reviews, NHIF flag, insurance[], verified/approved/excellence flags, hours, priceFrom, **branches[] (whiteboard-only, not yet modeled)**
- **Facility** — staff roster, appointments, verification status, branches[]
- **Appointment** — status enum, patient, facility/dentist, timestamps
- **PatientHealthRecord** — medical history, dental history, prescriptions, allergies, **maternal status (lactating/pregnant) (whiteboard-only, not yet modeled)**, author (patient vs clinician), owned by patient but writable by any verified treating clinician
- **Product** — brand, category, price, retail/wholesale price + min qty, dentist-recommended flag
- **Supplier** — scope (local/international), categories, products, storefront slug
- **Job** — type, employment, salary range, region
- **Course / Webinar** — format, specialty, CPD points, provider
- **MagazineItem** (article or video) — category, tags, author, HD/featured flags
- **Conversation / Message** — kind enum (by cross-role pairing), unread state
- **Call** — offer/answer/ICE signaling records
- **Region/Country config** — currency, subdivision label, feature flags, insurance providers

## 5. API surface already assumed by the frontend

`src/lib/api/` implies these backend resource groups: `auth`, `admin`, `calls`, `chat`, `config`, `facility`, `operator`, `patients`, `search`, `shopAdmin`, `suppliers`, `team`, `training`. All requests are JSON/REST, JWT bearer + cookie, with `Accept-Country`/`Accept-Currency`/`Accept-Language` headers driving locale — **this is a strong hint the backend needs country/currency-aware middleware from day one**, not bolted on later.

## 6. Non-functional considerations for system design

- **Multi-tenancy by country/currency** — baked into every API call already; design the DB/config layer around it rather than retrofitting.
- **Real-time-ish messaging** — currently polling-based (WebRTC signaling polls every ~12s), not sockets. Decide early: keep polling (simpler, works everywhere) or upgrade to WebSockets/SSE (better UX, more infra).
- **RBAC with facility-scoped sub-roles** — front-office vs clinical dentist within the *same* facility need different permissions on the *same* resource (appointments vs. charts). Model permissions per-facility-membership, not just per-user.
- **PHI/health data** — patient health records + prescriptions are real clinical data. Even for an MVP, plan for encryption at rest and audit logging early; retrofitting compliance is expensive.
- **Two auth surfaces** — public client auth vs. hidden staff auth — likely worth separate token scopes/issuers even if same DB.

## 7. Explicitly out of scope for MVP (pitch-deck aspirations, not built)

Flag these to your student as **vision**, not requirements to design against yet: government license verification, "AI trust score," AI symptom triage, AI best-match/cost-estimation, fake-review detection, live payment processing (M-Pesa/Stripe/Flutterwave), SMS integrations (Africa's Talking/Twilio), Redis caching/queues. None of this exists in the frontend today — it's pitch-deck narrative for investors, describing where the product *could* go once the core marketplace works. Good candidates for a "Phase 2" section in the system design doc, not the v1 architecture.

## 8. Whiteboard vs. code — mismatches to resolve

The Excalidraw notes are the founder's own intent and should generally win over what the current frontend happens to do, but a few gaps are worth a deliberate decision rather than silently picking one:

1. **Suppliers & CPD/training access.** Whiteboard: both should be restricted to "everyone registered as a medic." Code today: `/suppliers` and `/training` are public routes in `App.jsx` with no route guard — only their *dashboards* (`/dashboard/supplier`, `/dashboard/training`) are role-gated. Decide: is browsing meant to be public (discovery/marketing) with only *ordering/enrolling* gated, or should the whiteboard's stricter reading win and the browse pages themselves get locked behind medic verification?
2. **Facility branches.** Whiteboard calls for multi-branch facilities with insurance/reviews per profile; current mock data models one location per listing. Needs a real one-to-many schema decision before search/filtering logic is designed.
3. **Maternal status field.** Whiteboard lists it as a first-class health-record field; not present in code at all. Small schema addition, but worth confirming scope (is this a checkbox, or does it drive clinical logic like drug-interaction warnings?).
4. **Account model simplification.** Whiteboard's two-account-type model (Facility vs. Specialist) is simpler than the code's four-way facility-role split. Recommend keeping the code's finer roles as *permissions inside* a Facility account rather than collapsing them — but confirm with the student that's the intended reading.

## 9. Open questions to resolve before system design

1. Is there really a separate `denthub-api` repo already (README references it), or does it need to be built from scratch? This changes whether this is greenfield backend design or integration design.
2. Which single vertical should the MVP prove first — booking (patient↔facility) is the deck's core wedge; the other four modules (shop, jobs, training, magazine) could be deferred.