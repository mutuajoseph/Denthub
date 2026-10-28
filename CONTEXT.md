# DentHub

A multi-sided dental marketplace connecting patients, dental professionals,
suppliers, training providers, and job seekers, Kenya-first and multi-country.
Seeded from `docs/PRD.md` §2–4; sharpen entries with the `domain-modeling` skill
as terms get settled.

The terms and _Avoid_ lists govern code, data, API fields, issues, and tests.
User-facing copy uses the words patients use (a Facility can be a "clinic" on
screen).

## Language

### People and accounts

**Patient**:
A person seeking dental care, including one travelling across borders for it.
_Avoid_: Client, customer

**International Patient**:
A Patient seeking care in a Country other than their home Country, typically
starting with a Consultation Request. A situation, not a separate Profile.
_Avoid_: Dental tourist

**User**:
A login identity (email and password). One User can hold several Profiles and
Facility Memberships at once; a User is never itself a Patient or Specialist.
_Avoid_: Account (for the login), member

**Profile**:
One account type a User holds: Patient, Specialist, Supplier, or Training
Provider, at most one of each. Owning or working at a Facility is a Facility
Membership, not a Profile.
_Avoid_: Role (for the account type), persona

**Account Type**:
What a person chooses when they create an account: Patient, International
Patient, an individual dental professional, a Facility, a Supplier, or a
Training Provider. Choosing one creates the User's first Profile (or, for a
Facility, the Facility and an owner Facility Membership). Platform Staff are
never an Account Type — a staff role is granted, never chosen at signup.
_Avoid_: requested role, signup role

**Specialist**:
The account type for an individual dental professional (dentist, specialist,
or intern). One of the two professional account types chosen at signup.
_Avoid_: Doctor, practitioner

**Facility**:
The account type for a dental clinic or practice that employs Facility Staff.
The other professional account type chosen at signup.
_Avoid_: Clinic, practice

**Branch**:
One physical location of a Facility; a Facility has one or more.
_Avoid_: Location, site, address

**Workplace**:
A Branch where a Specialist practises. A Specialist has one or more, and
their directory presence is anchored on the primary one.
_Avoid_: employer, affiliation

**Facility Staff**:
A person working inside a Facility with a facility-scoped permission set, such
as Front Office (appointments and check-in only) or clinical (patient care).
Clinical work still needs a Care Grant to open a Health Record.
_Avoid_: Staff (unqualified), team

**Facility Membership**:
The link between a User and a Facility, carrying that User's permission set
there (owner, Front Office, or clinical). A User may hold memberships at many
Facilities.
_Avoid_: Facility role, employment, facility_id

**Invitation**:
An owner's emailed offer of a Facility Membership with a given permission set,
valid for 7 days.
_Avoid_: Invite link

**Verification**:
An application for DentHub to check a Specialist's, Facility's, Supplier's, or
Training Provider's credentials, moving PENDING → VERIFIED or REJECTED, and
revocable. Approving one raises the Verification tier to verified.
_Avoid_: Approval, KYC, account status

**Verified Medic**:
A Specialist or Facility whose Verification tier is verified or featured.
Browsing CPD and Suppliers is public; enrolling, ordering, and messaging a
Supplier need a Verified Medic.
_Avoid_: Verified user, approved doctor

**Verification tier**:
How far a Facility or Specialist profile has been checked by DentHub, one of
four grades in order: unverified, basic, verified, featured. Staff set it; it
grades the profile, it is not a set of independent flags.
_Avoid_: isVerified, approved/excellence flags

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
Platform Staff scoped to one Division at a Lead or Assistant tier.
_Avoid_: Moderator

**Division**:
One of the six areas an Operator is scoped to: Jobs, Shop, Training, Dentist,
International, Suppliers. An Operator belongs to exactly one.
_Avoid_: Department, vertical, category

**Operator tier**:
An Operator's authority inside their Division: a Lead may write, an Assistant
may only read.
_Avoid_: Level, rank

### Care

**Appointment**:
A Patient's requested visit to a Branch, optionally with a named Specialist,
moving PENDING → CONFIRMED → IN_PROGRESS (checked in) → COMPLETED, or ending
DECLINED, CANCELLED, or NO_SHOW. Its slot is wall-clock time in
the Listing's Country — "9:00 on the 3rd" at that clinic — not an absolute
instant, the same rule Opening Hours follow.
_Avoid_: Booking, visit

**Health Record**:
The Patient-owned record of medical and dental history, prescriptions,
allergies, and Maternal Status, readable and writable by clinicians holding a
Care Grant.
_Avoid_: Medical record, EHR, file

**Care Grant**:
A Patient's permission for a clinician to read and write their Health Record,
created by a confirmed Appointment or shared explicitly, expiring, and
revocable by the Patient. Front Office never holds one.
_Avoid_: Consent, access, share

**Clinical Entry**:
An append-only item in a Health Record with its author shown. It is
corrected only by an Amendment, never edited.
_Avoid_: Note (as the generic term), record entry

**Amendment**:
A Clinical Entry that corrects an earlier one, which stays visible.
_Avoid_: Edit, correction

**Maternal Status**:
Whether a Patient is pregnant, lactating, or neither; recorded for clinicians
to see, with no clinical logic attached.
_Avoid_: Pregnancy flag

**Review**:
A Patient's rating of a Branch (and its assigned Specialist) after a COMPLETED
Appointment; one per Appointment, with one public Facility reply.
_Avoid_: Rating (for the whole thing), feedback, testimonial

**Service**:
A treatment a Branch offers, from the platform-wide treatment list, with a
starting price in the Branch's currency.
_Avoid_: Procedure, offering

**On Call**:
A clinician's declared availability for emergencies at one Branch until a set
time, shown with the Branch's emergency phone.
_Avoid_: Duty, standby

**Consultation Request**:
An International Patient's pre-travel request to a Facility for a
teleconsultation and price, leading to a Quote.
_Avoid_: Enquiry (that belongs to training), lead

**Quote**:
A Facility's priced treatment plan for a Consultation Request, in the Branch's
currency, valid until a date; accepting it starts an Appointment request.
_Avoid_: Estimate, quotation, invoice

### Directory

**Listing**:
A Facility or Specialist as the directory presents it — a search result and
its profile page — graded by its Verification tier and carrying its Opening
Hours and price. A Job posting is never a Listing.
_Avoid_: vacancy, job post

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

**Order**:
A request to a Supplier for priced line items, carried in a Conversation
rather than a checkout, moving SUBMITTED → QUOTED → ACCEPTED → FULFILLED (or
CANCELLED) and settled off-platform. Either a Bulk Order or a Retail Order.
_Avoid_: Checkout, purchase, cart

**Bulk Order**:
An Order placed by a Facility or a Verified Medic.
_Avoid_: Supply order

**Retail Order**:
An Order placed by a Patient.
_Avoid_: Consumer order

**Product Recommendation**:
A clinician holding a Care Grant pointing a specific Patient to Products, with
a note; a separate flow from an Order on the same catalogue, and not a
Clinical Entry.
_Avoid_: Prescription (that belongs to the Health Record), dentist-recommended
(that is a catalogue badge)

### Messaging

**Party**:
Who a Conversation is with: a Patient, Specialist, Facility, Supplier, or
Training Provider, never a bare User. A Facility's messages are shared by its
members.
_Avoid_: Participant (for a User), recipient

**Conversation**:
A message thread between two Parties, optionally about a subject such as an
Appointment, Order, Enquiry, Consultation Request, or Job Application.
_Avoid_: Chat, thread, inbox

### Markets

**Country**:
A market DentHub operates in, with its own currency, Subdivision label,
insurance providers, and feature flags. The frontend's "region" is a Country,
or `GLOBAL` when none is chosen. It also carries two locales that are not the
same thing: the one it formats money in (`en-KE`), and the one the site falls
back to for a visitor who has chosen no language (`en`).
_Avoid_: Market, locale (as a name for the Country itself)

**Subdivision**:
The administrative area below Country (county in Kenya, state or province
elsewhere).
_Avoid_: County (as a generic term), area

**Opening Hours**:
A Branch's per-day open and close times, stored per weekday rather than as a
summary string, so "open now" is computed in the Branch's Country at read time
rather than stored as a flag that goes stale.
_Avoid_: Business hours string, availability

### Content and careers

**CPD**:
Continuing Professional Development credit a professional earns from Courses.
_Avoid_: Credits, points

**Content type**:
The kind of a Magazine Item: an article or a video.
_Avoid_: Media type, format

**Course**:
A training offering from a Training Provider, possibly carrying CPD.
_Avoid_: Class, program

**Enquiry**:
A Verified Medic's question to a Training Provider about a Course, carried in
a Conversation.
_Avoid_: Lead, inquiry

**Enrolment**:
A Verified Medic's place on a Course; when the Provider marks it complete it
issues a CPD Certificate. No payment is taken.
_Avoid_: Registration, signup

**CPD Certificate**:
The publicly verifiable record that a professional earned a Course's CPD.
_Avoid_: Diploma, credential

**Magazine Item**:
An article or video of one Content type, submitted by a Verified Medic and
published after review by Platform Staff.
_Avoid_: Post, blog

**Job**:
A posting by a Facility, at one of its Branches, that Specialists can apply
to.
_Avoid_: Vacancy, listing

**Job Application**:
A Specialist's application to a Job, moving SUBMITTED → SHORTLISTED → HIRED or
REJECTED, or WITHDRAWN by the applicant.
_Avoid_: Candidacy, submission
