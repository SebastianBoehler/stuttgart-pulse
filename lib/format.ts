import type { Locale } from "@/lib/types";

function getNumberLocale(locale: Locale) {
  return locale === "de" ? "de-DE" : "en-GB";
}

function formatNumber(value: number, locale: Locale, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(getNumberLocale(locale), {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatMetric(value: number, unit = "µg/m³", locale: Locale = "en") {
  return `${formatNumber(value, locale)} ${unit}`;
}

export function formatPercent(value: number, locale: Locale = "en") {
  return `${Math.round(value).toLocaleString(getNumberLocale(locale))}%`;
}

export function formatDateLabel(value: string, locale: Locale = "en") {
  return new Intl.DateTimeFormat(getNumberLocale(locale), {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string, locale: Locale = "en") {
  return new Intl.DateTimeFormat(getNumberLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

export function formatRangeLabel(days: number, locale: Locale = "en") {
  if (days === 1) {
    return locale === "de" ? "Letzte 24 Stunden" : "Last 24 hours";
  }

  return locale === "de" ? `Letzte ${days} Tage` : `Last ${days} days`;
}

export function formatDelta(current: number, previous: number, locale: Locale = "en") {
  const delta = current - previous;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${formatNumber(delta, locale)}`;
}

export function formatDistrictLabel(number: string | undefined, locale: Locale) {
  if (!number) {
    return locale === "de" ? "Stadtbezirk" : "District";
  }

  return locale === "de" ? `Stadtbezirk ${number}` : `District ${number}`;
}

export function formatFreshness(timestamp: string, locale: Locale = "en") {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));

  if (minutes < 60) {
    return locale === "de" ? `vor ${minutes} Min.` : `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);
  return locale === "de" ? `vor ${hours} Std.` : `${hours}h ago`;
}
