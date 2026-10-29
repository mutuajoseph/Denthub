# Account erasure anonymises the User row and completes immediately

#128 described deleting an account only after Platform Staff actioned it. We
chose immediate erasure instead: the User's right to erasure should not wait on
an internal queue, and the P5 console can later read completed Deletion Requests
without changing the model. The `users` row itself cannot be deleted because
Appointments and retained clinician-authored Clinical Entries reference it with
RESTRICT foreign keys. Erasure therefore scrubs every identity field, clears
`is_active` (which also rejects existing tokens), removes the User's Profiles,
Facility Memberships, and own Clinical Entries, and detaches the business
listings they owned. The Deletion Request records the retention window; a purge
job will remove the retained entries when that window ends.

## Consequences

- Appointments and sent Messages stay attached to the anonymised row rather than
  being deleted; the person is no longer identifiable through it.
- Supplier, Training Provider, and Specialist listings keep their public data
  and lose only the owner link.
- A future staff queue is additive: it writes or completes Deletion Requests but
  does not re-model erasure.
