import { de } from "@/messages/de";
import { en } from "@/messages/en";
import type { Locale } from "@/lib/types";

export const locales: Locale[] = ["de", "en"];

export const dictionaries = {
  de,
  en,
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
