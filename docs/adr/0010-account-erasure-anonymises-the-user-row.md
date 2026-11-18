# Account erasure anonymises the User row and completes immediately

#128 described deleting an account only after Platform Staff actioned it. We
chose immediate erasure instead: the User's right to erasure should not wait on
an internal queue, and the P5 console can later read completed Deletion Requests
without changing the model. The `users` row itself cannot be deleted because
Appointments and retained clinician-authored Clinical Entries reference it with
RESTRICT foreign keys. Erasure therefore scrubs every identity field, clears
`is_active` (which also rejects existing tokens), removes the User's Profiles,
Facility Memberships, and own Clinical Entries, erases the free text they wrote
(Message bodies, inbox previews, and Appointment notes), and detaches the
business listings they owned. The Deletion Request records the retention window;
a purge job will remove the retained entries when that window ends.

## Consequences

- Appointments stay attached to the anonymised row rather than being deleted;
  their Patient-authored `note` is cleared. The person is no longer identifiable
  through the row.
- Messages they sent keep their rows so the other participant's thread stays
  intact, but the body becomes `[deleted]` and any inbox preview of it is
  cleared. Received Messages are untouched: they are the other participant's
  words.
- Supplier and Training Provider listings keep their public data and lose only
  the owner link. A Specialist listing is an individual, so it also loses its
  name and name-derived slug and keeps a neutral placeholder instead.
- A retained Health Record records `maternal_status = "deleted"` rather than
  asserting a false `"none"`. `deleted` is not selectable through the API.
- A future staff queue is additive: it writes or completes Deletion Requests but
  does not re-model erasure.
