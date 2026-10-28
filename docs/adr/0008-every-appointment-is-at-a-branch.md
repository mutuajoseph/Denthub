# Every Appointment is at a Branch

Appointments today target either a Facility or a Specialist listing, so one
booked against a Specialist has no Facility, and nobody can ever confirm it.
Rather than give Specialists a second, facility-less booking model, every
Appointment carries a `branch_id`, with the Specialist optional. The Branch's
Facility members confirm it, and so can the named Specialist. Specialists stay
directory Listings with Workplaces as they are; a solo Specialist who wants
bookings gets a one-Branch Facility during onboarding. Bookings, Opening
Hours, Services, insurance, Reviews, and On Call all hang off the Branch.
