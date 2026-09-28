# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: patients looking for dental care, Kenya-first and increasingly
cross-border, who want to find a trustworthy dentist or facility and book.
Secondary: dental professionals (Specialists and Facilities) buying supplies,
finding jobs, and earning CPD; suppliers and training providers who sell to
them. Full role model: `docs/PRD.md` §2.

## Product Purpose

A multi-sided dental marketplace: find a dentist, shop oral care, and follow
dental jobs and training in one place, designed per Country (currency,
Subdivision labels, insurance providers, feature flags). The home page's job
is to get a patient to **Find a Dentist**; the shop is the secondary path.

## Positioning

One marketplace spanning the whole dental network of a Country (care, supplies,
careers, training), with cross-border care (the international-patient
teleconsultation-to-quote flow) designed in from the start rather than bolted on.

## Operating Context

Patients arrive on phones as often as desktops. Country is chosen in the header
and changes currency, Subdivision label ("county"/"state"), and copy. Emergency
access (on-call clinics, `tel:` links) must stay one tap away on every page.

## Capabilities and Constraints

- Built today: dentist search and profiles (fixture data), oral-care shop with
  retail/wholesale pricing (live API), cart, jobs, training, magazine,
  international and emergency pages, auth modal, rule-based "Dr. Denta" chatbot.
- Page copy and figures come from the region config and the placeholder Site
  CMS (`store/siteContentStore.ts`); preserve content, restyle presentation.
- Terminology follows `/CONTEXT.md` in code; UI copy may use patients' words
  ("clinic").
- Light theme only (decided 2026-09-28).

## Brand Commitments

- Name: DentHub, with an optional Country suffix in the wordmark.
- Visual system is pinned by `docs/design/DESIGN.md` (with `theme.css`,
  `variables.css`, `tokens.json`). Display type uses Inter Tight as the
  licensed-free stand-in for Neo Grotesk.

## Evidence on Hand

- No verified platform statistics. The Site CMS figures ("2,400+ Clinics
  Listed", "840+ Jobs", ...) are placeholders and are not shown.
- No verified trust credentials: license verification is out of scope (PRD §7),
  so badges such as "Licensed Dentists" or "HIPAA Aware" must not be presented
  as facts.
- Dentist listings and the hero dentist card are fixture data; illustrative
  use is fine, labelled or framed as an example.

## Product Principles

1. Get a patient to the right dentist in as few decisions as possible.
2. Prove with the product, never with invented numbers or credentials.
3. Every Country feels native: currency, labels, and insurers are local.
4. Emergency help is never more than one tap away.

## Accessibility & Inclusion

WCAG 2.1 AA contrast; visible keyboard focus; `prefers-reduced-motion`
respected; usable at 375px width with 44px touch targets.
