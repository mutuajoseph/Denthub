# Health Record access is by Care Grant, not by Facility

Today any clinical-role user whose Facility has had a confirmed Appointment with
a Patient can read and write that Patient's Health Record, forever, without a
Verification check, and reads are not logged. PRD §3 makes the record
Patient-owned and portable, and this is health data, so access becomes per
clinician through a Care Grant. A confirmed Appointment creates one for the
named Specialist (or the Branch's clinical members when none is named), and
the Patient can share the record explicitly with any Verified Medic. Patients
see and revoke grants; automatic grants lapse 90 days after the last
Appointment; Front Office never holds one. Clinical Entries are append-only and
corrected by Amendment, and every read and write lands in an audit log the
Patient can view.

## Consequences

- Facility membership alone never opens a chart; every Health Record route
  checks for a live Care Grant.
- Grant expiry is a stored `expires_at` compared at read time through one
  repository filter, never a stored status, so no background job exists.
- Field-level encryption is deferred; MVP relies on the database provider's
  encryption at rest.
