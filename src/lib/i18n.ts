export type Locale = string;
type Dictionary = Record<string, string>;
const en: Dictionary = {
  "home.error.title": "Error Loading Artists",
  "home.noResults.title": "No Artists Found",
  "home.noResults.search": 'Your search for "{query}" didn\'t return any results.',
  "home.noResults.filters": "Try adjusting your filters.",
};
const DICTIONARIES: Record<string, Dictionary> = { en };
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);
const LOCALE_KEY = "artistgrid-locale:v1";
function normalize(tag: string): string {
  return tag.toLowerCase().split("-")[0] || "";
}
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && DICTIONARIES[normalize(stored)]) return normalize(stored);
  } catch {}
  if (typeof navigator !== "undefined") {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const base = normalize(tag || "");
      if (DICTIONARIES[base]) return base;
    }
  }
  return "en";
}
let currentLocale: Locale | null = null;
function ensureLocale(): Locale {
  if (currentLocale === null) {
    currentLocale = detectLocale();
    applyDocumentAttributes(currentLocale);
  }
  return currentLocale;
}
function applyDocumentAttributes(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = RTL_LANGUAGES.has(locale) ? "rtl" : "ltr";
}
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES[ensureLocale()] ?? en;
  let text = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
export function getLocale(): Locale {
  return ensureLocale();
}
export function setLocale(locale: Locale): void {
  currentLocale = normalize(locale);
  try {
    localStorage.setItem(LOCALE_KEY, currentLocale);
  } catch {}
  applyDocumentAttributes(currentLocale);
}
export function availableLocales(): string[] {
  return Object.keys(DICTIONARIES);
}
