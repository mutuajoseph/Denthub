import { ArrowUpRight, Flag, Globe, Mail, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useRegion } from "../../hooks/useRegion";

const quickLinks = [
  { label: "Find a Dentist", to: "/dentists" },
  { label: "Oral Care Shop", to: "/shop" },
  { label: "Jobs Board", to: "/jobs" },
  { label: "Emergency Dental Care", to: "/emergency" },
];

const professionalLinks = [
  { label: "CPD Training", to: "/training" },
  { label: "Suppliers", to: "/suppliers" },
  { label: "International Patients", to: "/international" },
  { label: "Dentist Dashboard", to: "/dashboard" },
];

export function Footer() {
  const { region, brandName } = useRegion();
  const email = `hello@${region.domain}`;
  const phoneLabel = `${region.phonePrefix} 700 000 000`;
  const RegionIcon = region.code === "GLOBAL" ? Globe : Flag;

  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50 dark:border-navy-600 dark:bg-navy-950">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <section aria-labelledby="footer-about-heading">
          <Link to="/" className="font-heading text-xl font-bold text-[#11213a] dark:text-white">
            {brandName}
          </Link>
          <h2 id="footer-about-heading" className="sr-only">
            About {brandName}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-gray-300">
            {region.footerAbout ||
              `${region.countryName}'s complete dental platform for finding care, oral care, jobs, and training.`}
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
            <RegionIcon className="h-4 w-4 text-orange-500 dark:text-gold-400" aria-hidden="true" />
            {region.countryName}
          </p>
        </section>

        <section aria-labelledby="footer-quick-links-heading">
          <h2
            id="footer-quick-links-heading"
            className="font-heading text-base font-semibold text-slate-900 dark:text-white"
          >
            Quick Links
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-gray-300">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="transition-colors hover:text-orange-500 dark:hover:text-gold-400"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="footer-professional-links-heading">
          <h2
            id="footer-professional-links-heading"
            className="font-heading text-base font-semibold text-slate-900 dark:text-white"
          >
            For Dentists
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-gray-300">
            {professionalLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="transition-colors hover:text-orange-500 dark:hover:text-gold-400"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="footer-contact-heading">
          <h2
            id="footer-contact-heading"
            className="font-heading text-base font-semibold text-slate-900 dark:text-white"
          >
            Contact
          </h2>
          <address className="mt-4 space-y-3 text-sm not-italic text-slate-600 dark:text-gray-300">
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 transition-colors hover:text-orange-500 dark:hover:text-gold-400"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              {email}
            </a>
            <a
              href={`tel:${region.phonePrefix}700000000`}
              className="flex items-center gap-2 transition-colors hover:text-orange-500 dark:hover:text-gold-400"
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              {phoneLabel}
            </a>
            <a
              href={`https://${region.domain}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 transition-colors hover:text-orange-500 dark:hover:text-gold-400"
            >
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              {region.domain}
            </a>
          </address>
          <p className="mt-5 flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
            <ShieldCheck
              className="h-4 w-4 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            All clinics are reviewed for your safety.
          </p>
        </section>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-slate-200 px-4 py-5 text-xs text-slate-500 dark:border-navy-600 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p>
          © {new Date().getFullYear()} {brandName}
        </p>
        <p>General information on this site does not replace professional dental advice.</p>
      </div>
    </footer>
  );
}
