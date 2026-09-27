import { Building2, Globe2, GraduationCap, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { Link } from "react-router-dom";

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
    <div className="bg-white dark:bg-navy-900">
      <section className="overflow-hidden">
        <div className="app-container grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-orange-600 dark:bg-gold-400/10 dark:text-gold-400">
              About DentHub
            </span>

            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
              Building the future of <span className="text-orange-500">dental care</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-gray-300">
              DentHub connects patients, dentists, clinics, suppliers, and educators in one modern
              dental ecosystem. Discover trusted professionals, access oral care products, find
              opportunities, and grow your dental journey.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/dentists"
                className="rounded-full bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
              >
                Find a Dentist
              </Link>
              <Link
                to="/jobs"
                className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:border-orange-500 hover:text-orange-500 dark:border-navy-600 dark:text-gray-200"
              >
                Browse Dental Jobs
              </Link>
            </div>
          </div>

          {/* Decorative panel: the source page hot-linked a remote stock photo, so this
              keeps the page self-contained and consistent with the rest of the app. */}
          <div className="mt-12 lg:mt-0">
            <div className="relative h-[420px] w-full max-w-[380px] overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-700 to-orange-500 shadow-2xl">
              <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(249,168,37,0.45),transparent_60%)]"
                aria-hidden="true"
              />
              <div
                className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10"
                aria-hidden="true"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-900/60 to-transparent"
                aria-hidden="true"
              />

              <div className="absolute bottom-6 left-6 rounded-xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
                <p className="text-sm font-bold text-slate-900">Trusted Dental Care</p>
                <p className="text-xs text-slate-600">Patients first, always</p>
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
                className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl dark:border-navy-700 dark:bg-navy-800"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-gold-400/10 dark:text-gold-400">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>

                <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  {item.text}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
