// Product name, legal details and sign-up settings, all in one place.
// Fill in the blanks before opening sign-ups to the public.

export const PRODUCT = {
  /** Placeholder name: change it here and it updates everywhere. */
  name: "Reelpage",
  tagline: "Video for your emails, on a page that's yours",
};

/** Who runs the service. Shown in the footer, privacy notice and terms. Blank values are hidden. */
export const LEGAL = {
  company: "512 Media Group",
  companyNumber: "", // e.g. "Registered in England and Wales, no. 12345678"
  address: "Manchester, United Kingdom",
  contactEmail: "", // e.g. "privacy@512mediagroup.co.uk" (required by UK GDPR)
  icoNumber: "", // ICO data protection fee registration number, e.g. "ZB123456"
  lastUpdated: "16 October 2026",
};

/** Bump this when the terms or privacy notice change materially. Stored with each sign-up. */
export const TERMS_VERSION = "2026-10-16";

/** Cloudflare Turnstile site key (public). Leave blank until the widget is created in Cloudflare. */
export const TURNSTILE_SITE_KEY = "";

/** Free-trial limits. Must match TRIAL in supabase/functions/api/index.ts. */
export const TRIAL = { videos: 3, maxMinutes: 3, playsPerMonth: 300 };
