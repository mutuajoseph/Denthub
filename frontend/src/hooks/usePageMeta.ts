import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useRegion } from "./useRegion";

export interface PageMeta {
  title: string;
  description: string;
}

type MetaFactory = (brandName: string) => PageMeta;

const routeMeta: Record<string, MetaFactory> = {
  "/": (brandName) => ({
    title: `${brandName} — Complete Dental Platform`,
    description: `Find verified dentists, shop oral care, explore dental jobs and training with ${brandName}.`,
  }),
  "/about": (brandName) => ({
    title: `About ${brandName}`,
    description: `Learn how ${brandName} connects patients with trusted dental care and the wider dental community.`,
  }),
  "/dentists": (brandName) => ({
    title: `Find a Dentist — ${brandName}`,
    description: `Search verified dentists and clinics and find the right care with ${brandName}.`,
  }),
  "/find-dentist": (brandName) => ({
    title: `Find a Dentist — ${brandName}`,
    description: `Search verified dentists and clinics and find the right care with ${brandName}.`,
  }),
  "/shop": (brandName) => ({
    title: `Oral Care Shop — ${brandName}`,
    description: `Browse dentist-recommended oral care products with ${brandName}.`,
  }),
  "/jobs": (brandName) => ({
    title: `Dental Jobs Board — ${brandName}`,
    description: `Find dental assistant, dentist, hygienist and clinic jobs with ${brandName}.`,
  }),
  "/training": (brandName) => ({
    title: `Dental Skills & CPD Training — ${brandName}`,
    description: `Explore accredited dental courses, workshops and CPD with ${brandName}.`,
  }),
  "/magazine": (brandName) => ({
    title: `Dental Magazine & Videos — ${brandName}`,
    description: `Read practical dental guidance and watch dental videos from ${brandName}.`,
  }),
  "/international": (brandName) => ({
    title: `International Dental Patients — ${brandName}`,
    description: `Plan dental treatment abroad with trusted care coordination from ${brandName}.`,
  }),
  "/emergency": (brandName) => ({
    title: `Dental Emergency — ${brandName}`,
    description: `Find urgent dental care and emergency guidance with ${brandName}.`,
  }),
  "/suppliers": (brandName) => ({
    title: `Dental Supplier Marketplace — ${brandName}`,
    description: `Browse dental supplies and equipment from trusted suppliers on ${brandName}.`,
  }),
  "/messages": (brandName) => ({
    title: `Messages — ${brandName}`,
    description: `View your dental care messages on ${brandName}.`,
  }),
  "/dashboard": (brandName) => ({
    title: `Dashboard — ${brandName}`,
    description: `Manage your dental care account on ${brandName}.`,
  }),
  "/dashboard/facility": (brandName) => ({
    title: `Facility Dashboard — ${brandName}`,
    description: `Manage your dental facility and clinical team on ${brandName}.`,
  }),
  "/dashboard/supplier": (brandName) => ({
    title: `Supplier Dashboard — ${brandName}`,
    description: `Manage your dental supplier store on ${brandName}.`,
  }),
  "/dashboard/training": (brandName) => ({
    title: `Training Dashboard — ${brandName}`,
    description: `Manage your dental training programs on ${brandName}.`,
  }),
  "/admin": (brandName) => ({
    title: `Administration — ${brandName}`,
    description: `Administration tools for ${brandName}.`,
  }),
  "/operations": (brandName) => ({
    title: `Operations — ${brandName}`,
    description: `Operations tools for ${brandName}.`,
  }),
};

function cleanPath(pathname: string) {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function getPageMeta(pathname: string, brandName: string): PageMeta {
  const path = cleanPath(pathname);
  const exact = routeMeta[path];
  if (exact) return exact(brandName);

  if (path.startsWith("/dentist/")) {
    return {
      title: `Dentist Profile — ${brandName}`,
      description: `View clinic details, ratings and book an appointment with ${brandName}.`,
    };
  }

  if (path.startsWith("/suppliers/")) {
    return {
      title: `Supplier Store — ${brandName}`,
      description: `Browse dental products by category on ${brandName}.`,
    };
  }

  if (path.startsWith("/staff/")) {
    return {
      title: `Staff Access — ${brandName}`,
      description: `Secure staff access for ${brandName}.`,
    };
  }

  return routeMeta["/"](brandName);
}

function setMetaContent(selector: string, attribute: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    const match = /\[([a-z:]+)="([^"]*)"\]/i.exec(selector);
    if (match?.[1] && match[2] !== undefined) {
      element.setAttribute(match[1], match[2]);
    }
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, content);
}

function setCanonical(pathname: string, domain: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  const base = `https://${domain}`;
  const path = cleanPath(pathname);
  canonical.setAttribute("href", `${base}${path === "/" ? "" : path}`);
}

export function usePageMeta(pathname?: string) {
  const location = useLocation();
  const path = pathname ?? location.pathname;
  const { brandName, region } = useRegion();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const meta = getPageMeta(path, brandName);
    document.title = meta.title;
    setMetaContent('meta[name="description"]', "content", meta.description);
    setMetaContent('meta[property="og:title"]', "content", meta.title);
    setMetaContent('meta[property="og:description"]', "content", meta.description);
    setMetaContent('meta[property="og:site_name"]', "content", brandName);
    setCanonical(path, region.domain);
    document.documentElement.lang = region.locale;
  }, [brandName, path, region.domain, region.locale]);
}
