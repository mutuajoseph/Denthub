import type { MagazineCategory, MagazineItemType, TechIconKey } from "../config/magazineConstants";

interface MagazineItemBase {
  readonly id: string;
  readonly type: MagazineItemType;
  readonly title: string;
  readonly category: MagazineCategory;
  readonly tags: readonly string[];
  /** ISO date, so listings sort newest-first without a date library. */
  readonly publishedAt: string;
  readonly isFeatured: boolean;
  readonly isNew: boolean;
}

export interface MagazineArticle extends MagazineItemBase {
  readonly type: "article";
  readonly author: string;
  readonly authorClinic: string;
  readonly excerpt: string;
  readonly readMinutes: number;
  readonly body: readonly string[];
}

export interface MagazineVideo extends MagazineItemBase {
  readonly type: "video";
  readonly speaker: string;
  readonly speakerClinic: string;
  readonly excerpt: string;
  readonly duration: string;
  readonly views: number;
  /** Shown in the viewer. There is no media backend to stream from yet. */
  readonly summary: readonly string[];
}

export type MagazineItem = MagazineArticle | MagazineVideo;

export interface TechSpotlightItem {
  readonly id: string;
  readonly name: string;
  readonly maturity: string;
  readonly headline: string;
  readonly summary: string;
  readonly icon: TechIconKey;
}

const ITEMS: readonly MagazineItem[] = [
  {
    id: "mag-article-composite-resin",
    type: "article",
    title: "Modern Composite Resin: What Changed in the Last Five Years",
    category: "Clinical",
    tags: ["restorative", "composite", "materials"],
    publishedAt: "2026-01-18",
    isFeatured: true,
    isNew: true,
    author: "Dr. W. Otieno",
    authorClinic: "Nairobi Dental Care Centre",
    excerpt:
      "Filler loading, handling and polymerisation have all moved on. Here is what actually changes at the chairside.",
    readMinutes: 7,
    body: [
      "Composite resin has quietly become a different material from the one most clinicians trained on. Total filler content in universal composites now regularly exceeds 75%, which is where the improvement in strength-to-handling balance comes from.",
      "Shorter curing times are the other headline change. Low-shrinkage and bulk-fill formulations let you place thicker increments without sacrificing the wall quality you would have fought for with a 2 mm layering technique.",
      "The practical takeaway: choose a universal composite for posterior bulk and a flowable liner where adaptation matters, and stop chasing translucency levels that the light cure never gave you anyway.",
    ],
  },
  {
    id: "mag-article-ai-imaging",
    type: "article",
    title: "AI-Assisted Imaging: Where It Helps Today and Where It Doesn't",
    category: "Technology",
    tags: ["ai", "radiography", "diagnostics"],
    publishedAt: "2026-01-12",
    isFeatured: false,
    isNew: false,
    author: "Dr. A. Mohamed",
    authorClinic: "Coast General Dental Centre",
    excerpt:
      "Detection software is now cheap enough that the question is no longer whether to use it, but whether to trust it as a second reader.",
    readMinutes: 9,
    body: [
      "Caries detection and periapical pathology triage tools have crossed the threshold where they are affordable for a two-chair practice. Used as a second reader, they measurably reduce missed findings on bitewings.",
      "They are not a replacement for interpretation. False positives on cervical burnout and root caries remain common, and a report that flags a lesion the clinician cannot see does not improve care.",
      "The defensible pattern is narrow: flag, then confirm. Anything a tool flags gets a human look before a treatment plan changes.",
    ],
  },
  {
    id: "mag-article-recall-systems",
    type: "article",
    title: "Building a Recall System Patients Actually Turn Up To",
    category: "Practice Management",
    tags: ["recall", "systems", "patient retention"],
    publishedAt: "2026-01-06",
    isFeatured: false,
    isNew: true,
    author: "Dr. L. Kariuki",
    authorClinic: "Dental Partners Kenya",
    excerpt:
      "Most recall failures are scheduling failures, not reminder failures. Fix the chair time first.",
    readMinutes: 6,
    body: [
      "A recall list nobody calls is worse than no list, because it quietly inflates your patient count while the actual attendance rate falls.",
      "Start by matching the recall interval to the clinical need rather than a calendar default. A six-month recall for a stable periodontal patient is a scheduling fiction.",
      "Then protect the slot. Practices that hold a specific short appointment window for recalls see attendance rise more than practices that add another reminder channel.",
    ],
  },
  {
    id: "mag-article-child-brushing",
    type: "article",
    title: "Explaining Flossing to a Four-Year-Old",
    category: "Patient Education",
    tags: ["paediatric", "prevention", "parent education"],
    publishedAt: "2025-12-20",
    isFeatured: false,
    isNew: false,
    author: "Dr. N. Wambui",
    authorClinic: "Nakuru Children's Dental",
    excerpt:
      "Parents do not need a lecture. They need one instruction they can actually repeat at bedtime.",
    readMinutes: 4,
    body: [
      "Give the parent a single concrete instruction: two minutes, twice a day, with the parent doing it until the child can manage a decent tealike flick.",
      "Demonstrate on the parent's own teeth before the child's. Adults rarely do this correctly, and an unmodelled technique is passed straight down.",
      "Avoid language about cavities and sugar at this age. Children absorb the emotional framing more reliably than the instruction.",
    ],
  },
  {
    id: "mag-article-enamel-remineralisation",
    type: "article",
    title: "Remineralisation: What the Evidence Actually Supports",
    category: "Research",
    tags: ["fluoride", "hydroxyapatite", "evidence"],
    publishedAt: "2025-12-11",
    isFeatured: false,
    isNew: false,
    author: "Dr. W. Otieno",
    authorClinic: "Nairobi Dental Care Centre",
    excerpt:
      "Fluoride remains the benchmark. Hydroxyapatite is a reasonable adjunct, not a replacement.",
    readMinutes: 8,
    body: [
      "The highest-quality evidence still sits with fluoride for both caries prevention and enamel repair. That is not close, and marketing copy should not pretend otherwise.",
      "Hydroxyapatite formulations show a real but smaller effect, largely in the very early lesion window. They are a defensible addition for high-risk patients who struggle with fluoride routines.",
      "The practical order is: fluoride twice daily, interdental cleaning, then diet frequency. Everything else is third in line.",
    ],
  },
  {
    id: "mag-video-handpiece-maintenance",
    type: "video",
    title: "Extending Handpiece Life: A 12-Minute Routine",
    category: "Clinical",
    tags: ["maintenance", "infection control"],
    publishedAt: "2026-01-15",
    isFeatured: false,
    isNew: true,
    speaker: "Dr. L. Kariuki",
    speakerClinic: "Dental Partners Kenya",
    excerpt:
      "Most handpiece failures are lubrication and water-path problems, and both are preventable in under a minute per day.",
    duration: "12 min",
    views: 1840,
    summary: [
      "This session walks through the daily routine that keeps turbine cartridges alive: correct oil volume, angled nozzle alignment, and running the coolant path until it clears.",
      "The second half covers the storage mistake most practices make — capping a handpiece while it is still wet, which traps moisture against the turbine end.",
    ],
  },
  {
    id: "mag-video-compositing-quickly",
    type: "video",
    title: "Fast Compositing Without Sacrificing the Contact",
    category: "Clinical",
    tags: ["restorative", "technique", "aesthetics"],
    publishedAt: "2026-01-09",
    isFeatured: false,
    isNew: false,
    speaker: "Dr. A. Mohamed",
    speakerClinic: "Coast General Dental Centre",
    excerpt: "Single-visit posterior restoration technique, from matrix selection to final polish.",
    duration: "9 min",
    views: 2610,
    summary: [
      "A full single-visit posterior composite, recorded start to finish, with commentary on the contacts section.",
      "Particular attention is paid to the sectional matrix, the wedge, and the final polish step that most clinicians skip.",
    ],
  },
  {
    id: "mag-video-practice-records",
    type: "video",
    title: "Patient Records That Survive an Audit",
    category: "Practice Management",
    tags: ["records", "compliance", "systems"],
    publishedAt: "2025-12-28",
    isFeatured: false,
    isNew: false,
    speaker: "Dr. N. Wambui",
    speakerClinic: "Nakuru Children's Dental",
    excerpt:
      "What to record, in what order, so a clinical record defends itself without slowing the chairside down.",
    duration: "15 min",
    views: 1120,
    summary: [
      "A records walkthrough with real (de-identified) examples of notes that pass scrutiny and notes that do not.",
      "Covers consent, presenting history, treatment planning, and the follow-up entries that quietly matter most when a complaint arrives.",
    ],
  },
];

const TECH_SPOTLIGHT: readonly TechSpotlightItem[] = [
  {
    id: "tech-ai",
    name: "AI Diagnostics",
    maturity: "In mainstream practice",
    headline: "Second-reader detection is now affordable",
    summary:
      "Caries and periapical triage tools cost less than a month of imaging software and measurably reduce missed findings.",
    icon: "brain",
  },
  {
    id: "tech-3d",
    name: "3D Printing",
    maturity: "Adopting fast",
    headline: "Same-day aligners and surgical guides",
    summary:
      "Chairside resin printing has moved from curiosity to a realistic same-day workflow for aligners, splints and guides.",
    icon: "printer",
  },
  {
    id: "tech-teledentistry",
    name: "Teledentistry",
    maturity: "Routine in some regions",
    headline: "Remote triage is filling the access gap",
    summary:
      "Photo and video triage are taking pressure off rural clinics, particularly for paediatric and orthodontic review.",
    icon: "video",
  },
  {
    id: "tech-prevention",
    name: "Preventive Devices",
    maturity: "Early adoption",
    headline: "Beyond the electric toothbrush",
    summary:
      "Drug-eluting and remineralising devices are giving high-risk patients options that sit between brushing and a prescription.",
    icon: "zap",
  },
  {
    id: "tech-materials",
    name: "Bioactive Materials",
    maturity: "Selectively available",
    headline: "Materials that release ions on demand",
    summary:
      "Alkalis and ion-releasing composites are useful in the sandwich technique and around provisionals.",
    icon: "sparkles",
  },
  {
    id: "tech-regenerative",
    name: "Regenerative Endodontics",
    maturity: "Specialist centres",
    headline: "Revascularisation moving into routine practice",
    summary:
      "Still specialist-led, but the protocols are standardised enough that referral no longer means losing the tooth.",
    icon: "flask",
  },
];

export function listMagazineFixtures(): readonly MagazineItem[] {
  return ITEMS;
}

export function listTechSpotlightFixtures(): readonly TechSpotlightItem[] {
  return TECH_SPOTLIGHT;
}
