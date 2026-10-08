import { ArrowUpRight, Flag, Globe, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useRegion } from "../../hooks/useRegion";
import { useTrainingEnabled } from "../../hooks/useTraining";

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

const linkClass =
  "flex w-fit items-center gap-2 rounded-link text-paper/70 transition-colors hover:text-paper";
const headingClass = "text-sm font-medium text-paper/60";

export function Footer() {
  const { region, brandName } = useRegion();
  const trainingEnabled = useTrainingEnabled();
  const dentistLinks = trainingEnabled
    ? professionalLinks
    : professionalLinks.filter((link) => link.to !== "/training");
  const email = `hello@${region.domain}`;
  const RegionIcon = region.code === "GLOBAL" ? Globe : Flag;

  return (
    <footer className="mt-auto border-t border-white/10 bg-ink pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] text-paper md:pb-0">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-12 pt-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <section aria-labelledby="footer-about-heading" className="max-w-sm">
          <Link
            to="/"
            className="rounded-link font-display text-feature-heading font-medium text-paper"
          >
            {brandName}
          </Link>
          <h2 id="footer-about-heading" className="sr-only">
            About {brandName}
          </h2>
          <p className="mt-4 text-sm leading-[1.5] text-paper/70">
            {region.footerAbout ||
              `${region.countryName}'s complete dental platform for finding care, oral care, jobs, and training.`}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-button bg-graphite px-3 py-2 text-sm text-paper shadow-edge">
            <RegionIcon className="h-4 w-4 text-paper" strokeWidth={1.8} aria-hidden="true" />
            {region.countryName}
          </p>
        </section>

        <section aria-labelledby="footer-quick-links-heading">
          <h2 id="footer-quick-links-heading" className={headingClass}>
            Quick Links
          </h2>
          <ul className="mt-5 space-y-3 text-sm">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="footer-professional-links-heading">
          <h2 id="footer-professional-links-heading" className={headingClass}>
            For Dentists
          </h2>
          <ul className="mt-5 space-y-3 text-sm">
            {dentistLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="footer-contact-heading">
          <h2 id="footer-contact-heading" className={headingClass}>
            Contact
          </h2>
          <address className="mt-5 space-y-3 text-sm not-italic">
            <a href={`mailto:${email}`} className={linkClass}>
              <Mail className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              {email}
            </a>
            <a
              href={`https://${region.domain}`}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              {region.domain}
            </a>
          </address>
        </section>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-white/10 px-4 py-5 text-xs text-paper/50 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          © {new Date().getFullYear()} {brandName}
        </p>
        <p>General information on this site does not replace professional dental advice.</p>
      </div>
    </footer>
  );
}
