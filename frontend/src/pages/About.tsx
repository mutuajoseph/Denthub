import { Building2, Globe2, GraduationCap, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

const FEATURES = [
  {
    icon: Stethoscope,
    title: "Trusted Dental Network",
    text: "Connect patients with qualified dentists and dental clinics across regions.",
  },
  {
    icon: Users,
    title: "Built For Everyone",
    text: "A complete ecosystem designed for patients, dentists, students, and businesses.",
  },
  {
    icon: Building2,
    title: "Clinic Growth",
    text: "Helping clinics improve visibility, manage teams, and grow their practice.",
  },
  {
    icon: GraduationCap,
    title: "Learning & Training",
    text: "Access dental education, CPD programs, and professional development.",
  },
  {
    icon: ShieldCheck,
    title: "Quality First",
    text: "Focused on trust, transparency, and better dental experiences.",
  },
  {
    icon: Globe2,
    title: "Connected Globally",
    text: "Bringing dental communities together through one digital platform.",
  },
] as const;

export function About() {
  return (
    <div className="bg-paper">
      <section className="overflow-hidden">
        <div className="app-container grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl font-medium tracking-[-0.04em] text-ink sm:text-5xl lg:text-display-section">
              Building the future of dental care
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate">
              DentHub connects patients, dentists, clinics, suppliers, and educators in one modern
              dental ecosystem. Discover trusted professionals, access oral care products, find
              opportunities, and grow your dental journey.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button to="/dentists" size="lg">
                Find a Dentist
              </Button>
              <Link
                to="/jobs"
                className="inline-flex min-h-12 items-center justify-center rounded-card border border-steel px-6 py-3 font-semibold text-ink transition hover:bg-cloud"
              >
                Browse Dental Jobs
              </Link>
            </div>
          </div>

          {/* Decorative panel: the source page hot-linked a remote stock photo, so this
              keeps the page self-contained and consistent with the rest of the app. */}
          <div className="mt-12 lg:mt-0">
            <div className="construction-grid relative h-[420px] w-full max-w-[380px] overflow-hidden rounded-card border border-steel bg-cloud">
              <div
                className="absolute left-8 top-10 h-40 w-56 rounded-card border border-steel bg-paper shadow-card-white"
                aria-hidden="true"
              />
              <div
                className="absolute left-20 top-32 h-40 w-56 rounded-card border border-steel bg-cloud shadow-card-cloud"
                aria-hidden="true"
              />
              <div
                className="absolute right-8 top-16 h-32 w-40 rounded-card bg-graphite shadow-card-graphite"
                aria-hidden="true"
              />

              <div className="absolute bottom-6 left-6 rounded-card bg-paper px-4 py-3 shadow-card-cloud">
                <p className="text-sm font-semibold text-ink">Trusted Dental Care</p>
                <p className="text-xs text-slate">Patients first, always</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-container pb-20">
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="rounded-card border border-steel bg-paper p-6 transition hover:-translate-y-1 hover:shadow-card-cloud"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-button bg-cloud text-charcoal">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>

                <h2 className="font-heading text-lg font-semibold text-ink">{item.title}</h2>

                <p className="mt-3 text-sm leading-6 text-slate">{item.text}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
