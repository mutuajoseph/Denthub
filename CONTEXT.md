# DentHub

A multi-sided dental marketplace connecting patients, dental professionals,
suppliers, training providers, and job seekers, Kenya-first and multi-country.
Seeded from `docs/PRD.md` §2–4; sharpen entries with the `domain-modeling` skill
as terms get settled.

## Language

### People and accounts

**Patient**:
A person seeking dental care, including one travelling across borders for it.
_Avoid_: Client, customer

**International Patient**:
A Patient seeking care in another Country, typically starting with a
teleconsultation to get a quotation.
_Avoid_: Dental tourist

**Specialist**:
The account type for an individual dental professional (dentist, specialist,
or intern). One of the two professional account types chosen at signup.
_Avoid_: Doctor, practitioner

**Facility**:
The account type for a dental clinic or practice that employs Facility Staff.
The other professional account type chosen at signup.
_Avoid_: Clinic, practice (in code and data)

**Branch**:
One physical location of a Facility; a Facility has one or more.
_Avoid_: Location, site, address

**Facility Staff**:
A person working inside a Facility with a facility-scoped permission set, such
as Front Office (appointments and check-in only) or clinical (full chart access).
_Avoid_: Staff (unqualified), team

**Verified Medic**:
A Specialist or Facility whose professional status has been verified. Whether
it gates browsing or only ordering/enrolling in CPD and Suppliers is open
(PRD §8.1).
_Avoid_: Verified user, approved doctor

**Supplier**:
A business selling oral-care or dental products, either local or
international in scope.
_Avoid_: Vendor, seller, shop (for the business itself)

**Training Provider**:
An organisation offering Courses and webinars to dental professionals.
_Avoid_: School, trainer

**Platform Staff**:
DentHub's own people (Admins and Operators), who sign in through a separate
internal route, never the public login.
_Avoid_: Staff (unqualified), internal user

**Operator**:
Platform Staff scoped to one Division (Jobs, Shop, Training, Dentist,
International, Suppliers) at a Lead or Assistant tier.
_Avoid_: Moderator

### Care

**Appointment**:
A booked visit between a Patient and a Facility or Specialist, moving through
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED.
_Avoid_: Booking, visit

**Health Record**:
The Patient-owned record of medical and dental history, prescriptions,
allergies, and maternal status, writable by any Verified Medic treating them.
_Avoid_: Medical record, EHR, file

### Shop

**Product**:
An oral-care item in the shared catalogue, sold by a Supplier.
_Avoid_: Item, SKU

**Retail Price**:
A Product's per-unit price below the Wholesale Threshold.
_Avoid_: Base price, list price

**Wholesale Price**:
A Product's per-unit price at or above the Wholesale Threshold.
_Avoid_: Bulk price, discount price

**Wholesale Threshold**:
The quantity (12 by default) at which a line switches from Retail Price to
Wholesale Price automatically.
_Avoid_: Minimum order, MOQ

**Bulk Order**:
A Facility's order for supplies, placed by messaging the shop rather than
through a checkout.
_Avoid_: Checkout, purchase

**Product Recommendation**:
A treating Specialist pointing a specific Patient to a Product; a separate
flow from a Bulk Order on the same catalogue.
_Avoid_: Prescription (that belongs to the Health Record)

### Markets

**Country**:
A market DentHub operates in, with its own currency, Subdivision label,
insurance providers, and feature flags. The frontend's "region" is a Country,
or `GLOBAL` when none is chosen.
_Avoid_: Market, locale

**Subdivision**:
The administrative area below Country (county in Kenya, state or province
elsewhere).
_Avoid_: County (as a generic term), area

### Content and careers

**CPD**:
Continuing Professional Development credit a professional earns from Courses.
_Avoid_: Credits, points

**Course**:
A training offering from a Training Provider, possibly carrying CPD.
_Avoid_: Class, program

**Magazine Item**:
An article or video published by a Verified Medic.
_Avoid_: Post, blog

**Job**:
A posting by an employer (usually a Facility) that job seekers can apply to.
_Avoid_: Vacancy, listing
