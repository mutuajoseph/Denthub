import { create } from "zustand";
import { persist } from "zustand/middleware";

const clone = (data: unknown) => JSON.parse(JSON.stringify(data));

export interface HowItWorksStep {
  icon?: string;
  emoji?: string;
  title: string;
  desc: string;
}

export interface HeroCard {
  name: string;
  clinicLine: string;
  rating: number;
  specialties: string[];
}

export interface HomeContent {
  howItWorksTitle: string;
  howItWorksSteps: HowItWorksStep[];
  featuredClinicsTitle: string;
  heroCard: HeroCard;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
}

export interface SiteContent {
  home: HomeContent;
  jobsBoard: { title: string; subtitle: string };
  jobs: unknown[];
  shop: {
    subscriptionTitle: string;
    subscriptionSubtitle: string;
    products: unknown[];
    subscriptionTiers: SubscriptionTier[];
  };
  training: {
    title: string;
    subtitle: string;
    courses: unknown[];
    webinars: unknown[];
  };
  findDentist: { title: string; subtitle: string };
  dentists: unknown[];
  practices: unknown[];
  international: {
    heroTitle: string;
    heroHighlight: string;
    heroSub: string;
    stat1Value: string;
    stat1Label: string;
    stat2Value: string;
    stat2Label: string;
    steps: unknown[];
    benefitCards: unknown[];
    comparisons: unknown[];
  };
  emergency: Record<string, string>;
  suppliers: {
    title: string;
    subtitle: string;
    guestHint: string;
    categories: string[];
  };
}

export function getDefaultSiteContent(): SiteContent {
  return {
    home: {
      howItWorksTitle: "How DentHub Works",
      howItWorksSteps: [
        { icon: "Search", title: "Search", desc: "Find dentists by county, specialty, or NHIF" },
        { icon: "Calendar", title: "Book", desc: "Book appointments online in minutes" },
        {
          icon: "ShoppingBag",
          title: "Shop",
          desc: "Buy dentist-recommended oral care — no login needed",
        },
        {
          icon: "GraduationCap",
          title: "Grow",
          desc: "Access jobs and CPD training for your career",
        },
      ],
      featuredClinicsTitle: "Featured Clinics",
      heroCard: {
        name: "Dr. Wanjiku Kamau",
        clinicLine: "SmileCare Dental · Westlands",
        rating: 4.9,
        specialties: ["General", "Cosmetic"],
      },
    },
    jobsBoard: {
      title: "Dental Jobs Board Kenya",
      subtitle: "Find your next role — from BDS positions to clinic support",
    },
    jobs: [],
    shop: {
      subscriptionTitle: "Oral Care Subscriptions",
      subscriptionSubtitle: "Never run out of essentials — delivered monthly",
      products: [],
      subscriptionTiers: [
        {
          id: "basic",
          name: "Basic",
          price: 500,
          features: ["1 toothbrush monthly", "Toothpaste sample", "Free delivery in Nairobi"],
        },
        {
          id: "family",
          name: "Family",
          price: 1200,
          features: [
            "4 brushes monthly",
            "Family toothpaste",
            "Floss & mouthwash",
            "County-wide delivery",
          ],
          popular: true,
        },
        {
          id: "premium",
          name: "Premium",
          price: 2500,
          features: [
            "Premium electric brush",
            "Full oral care kit",
            "Whitening strips quarterly",
            "Nationwide delivery",
            "Dentist hotline access",
          ],
        },
      ],
    },
    training: {
      title: "Skills & CPD Training",
      subtitle: "Advance your dental career with accredited courses and workshops",
      courses: [],
      webinars: [],
    },
    findDentist: {
      title: "Find a Dentist",
      subtitle: "Verified clinics nationwide",
    },
    dentists: [],
    practices: [],
    international: {
      heroTitle: "World-Class Dental Care.",
      heroHighlight: "70% Less Than Home.",
      heroSub: "Kenya's most trusted dental tourism platform",
      stat1Value: "£2,000+",
      stat1Label: "Avg savings vs UK",
      stat2Value: "500+",
      stat2Label: "International patients",
      steps: [
        { icon: "Stethoscope", title: "Browse Specialists", desc: "Filter by treatment needed" },
        {
          icon: "MessageCircle",
          title: "Free Online Consultation",
          desc: "Video call before you fly",
        },
        { icon: "Clipboard", title: "Get Your Quote", desc: "In USD, GBP, or EUR" },
        { icon: "Plane", title: "Book & Pay Deposit", desc: "Secure payment" },
        { icon: "Flag", title: "Arrive & Get Treated", desc: "We handle everything" },
        { icon: "Sparkles", title: "Optional Safari", desc: "Safari add-on package" },
      ],
      benefitCards: [
        {
          title: "Cost Savings",
          desc: "Save up to 70% compared to UK, US, and UAE prices",
          icon: "DollarSign",
        },
        {
          title: "Qualified Dentists",
          desc: "KMPDC registered specialists with international training",
          icon: "Stethoscope",
        },
        {
          title: "Safari Experience",
          desc: "Combine world-class dental care with Kenya's wildlife",
          icon: "Sparkles",
        },
      ],
      comparisons: [
        { treatment: "Root Canal", uk: "£800", kenya: "KES 15,000 (~£90)" },
        { treatment: "Dental Implant", uk: "£2,500", kenya: "KES 80,000 (~£480)" },
        { treatment: "Veneers (per tooth)", uk: "£600", kenya: "KES 25,000 (~£150)" },
      ],
    },
    emergency: {
      banner: "DENTAL EMERGENCY — We're here to help",
      title: "Find Emergency Dental Care Now",
      subtitle: "Toothaches, broken teeth, abscesses — find an open clinic right now",
      triageTitle: "Can't travel? Get emergency advice online",
      triageDesc: "Upload a photo and describe your pain",
      triageFeeLabel: "Fee: KES 300",
      intlTitle: "International Visitor Emergency?",
      intlSubtitle: "English-speaking dentists with tourism experience",
    },
    suppliers: {
      title: "Supplier Marketplace",
      subtitle: "Wholesale dental supplies with international shipping",
      guestHint: "Dentist login required to access wholesale supplies and logistics.",
      categories: [
        "Dental Chairs",
        "Autoclaves",
        "Consumables",
        "Imaging Equipment",
        "Lab Materials",
        "PPE",
      ],
    },
  };
}

interface SiteContentState extends SiteContent {
  resetToDefaults: () => void;
  importContent: (payload: Record<string, unknown>) => void;
  exportSnapshot: () => Record<string, unknown>;
  patchHome: (partial: Partial<HomeContent>) => void;
  setHowItWorksSteps: (steps: HowItWorksStep[]) => void;
  setHeroCard: (heroCard: Partial<HeroCard>) => void;
  patchJobsBoard: (partial: Partial<SiteContent["jobsBoard"]>) => void;
  setJobs: (jobs: unknown[]) => void;
  patchShop: (partial: Partial<SiteContent["shop"]>) => void;
  setProducts: (products: unknown[]) => void;
  patchTraining: (partial: Partial<SiteContent["training"]>) => void;
  setCourses: (courses: unknown[]) => void;
  patchFindDentist: (partial: Partial<SiteContent["findDentist"]>) => void;
  setDentists: (dentists: unknown[]) => void;
  patchInternational: (partial: Partial<SiteContent["international"]>) => void;
  patchEmergency: (partial: Record<string, string>) => void;
  patchSuppliers: (partial: Partial<SiteContent["suppliers"]>) => void;
  setSupplierCategories: (categories: string[]) => void;
}

type PersistedState = Pick<
  SiteContent,
  | "home"
  | "jobsBoard"
  | "jobs"
  | "shop"
  | "training"
  | "findDentist"
  | "dentists"
  | "practices"
  | "international"
  | "emergency"
  | "suppliers"
>;

export const useSiteContentStore = create<SiteContentState>()(
  persist(
    (set, get) => ({
      ...getDefaultSiteContent(),

      resetToDefaults: () => set(getDefaultSiteContent()),

      importContent: (payload) => {
        if (!payload || typeof payload !== "object") return;
        const next = getDefaultSiteContent();
        const merged: Record<keyof SiteContent, unknown> = { ...next };
        const keys = Object.keys(next) as (keyof SiteContent)[];
        for (const k of keys) {
          if (payload[k] !== undefined) merged[k] = clone(payload[k]);
        }
        set(merged as unknown as Partial<SiteContentState>);
      },

      exportSnapshot: () =>
        clone({
          home: get().home,
          jobsBoard: get().jobsBoard,
          jobs: get().jobs,
          shop: get().shop,
          training: get().training,
          findDentist: get().findDentist,
          dentists: get().dentists,
          international: get().international,
          emergency: get().emergency,
          suppliers: get().suppliers,
        }),

      patchHome: (partial) => set((s) => ({ home: { ...s.home, ...partial } })),

      setHowItWorksSteps: (steps) =>
        set((s) => ({ home: { ...s.home, howItWorksSteps: clone(steps) } })),

      setHeroCard: (heroCard) =>
        set((s) => ({ home: { ...s.home, heroCard: { ...s.home.heroCard, ...heroCard } } })),

      patchJobsBoard: (partial) => set((s) => ({ jobsBoard: { ...s.jobsBoard, ...partial } })),

      setJobs: (jobs) => set({ jobs: clone(jobs) }),

      patchShop: (partial) => set((s) => ({ shop: { ...s.shop, ...partial } })),

      setProducts: (products) => set((s) => ({ shop: { ...s.shop, products: clone(products) } })),

      patchTraining: (partial) => set((s) => ({ training: { ...s.training, ...partial } })),

      setCourses: (courses) =>
        set((s) => ({ training: { ...s.training, courses: clone(courses) } })),

      patchFindDentist: (partial) =>
        set((s) => ({ findDentist: { ...s.findDentist, ...partial } })),

      setDentists: (dentists) => set({ dentists: clone(dentists) }),

      patchInternational: (partial) =>
        set((s) => ({ international: { ...s.international, ...partial } })),

      patchEmergency: (partial) => set((s) => ({ emergency: { ...s.emergency, ...partial } })),

      patchSuppliers: (partial) => set((s) => ({ suppliers: { ...s.suppliers, ...partial } })),

      setSupplierCategories: (categories) =>
        set((s) => ({ suppliers: { ...s.suppliers, categories: clone(categories) } })),
    }),
    {
      name: "denthub-site-content",
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        // v3 removed the invented Home stats (they moved to `GET /home/stats`),
        // so any store that could still carry a `stats` array resets to default.
        if (version < 3) {
          return getDefaultSiteContent();
        }
        return persistedState as PersistedState;
      },
      partialize: (state) => ({
        home: state.home,
        jobsBoard: state.jobsBoard,
        jobs: state.jobs,
        shop: state.shop,
        training: state.training,
        findDentist: state.findDentist,
        dentists: state.dentists,
        practices: state.practices,
        international: state.international,
        emergency: state.emergency,
        suppliers: state.suppliers,
      }),
    },
  ),
);
