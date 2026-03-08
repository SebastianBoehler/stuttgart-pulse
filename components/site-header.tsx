"use client";

import Link from "next/link";
import { ActivitySquare } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

type SiteHeaderProps = {
  locale: Locale;
  dictionary: Dictionary;
  pathSuffix: "" | "/explorer" | "/compare" | "/about";
};

function toHref(locale: Locale, pathSuffix: SiteHeaderProps["pathSuffix"]) {
  return pathSuffix ? `/${locale}${pathSuffix}` : `/${locale}`;
}

export function SiteHeader({ locale, dictionary, pathSuffix }: SiteHeaderProps) {
  const links = [
    { href: `/${locale}/explorer`, label: dictionary.nav.explorer },
    { href: `/${locale}/compare`, label: dictionary.nav.compare },
    { href: `/${locale}/about`, label: dictionary.nav.about },
  ];
  const currentHref = toHref(locale, pathSuffix);

  return (
    <header className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-5 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/20">
            <ActivitySquare className="size-5" />
          </div>
          <div>
            <p className="font-display text-xl leading-none">Stuttgart Pulse</p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Move • Breathe • Compare</p>
          </div>
        </Link>
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex items-center gap-1 rounded-full border border-line bg-card px-2 py-2 text-sm font-semibold">
            {(["de", "en"] as const).map((targetLocale) => (
              <Link
                key={targetLocale}
                href={toHref(targetLocale, pathSuffix)}
                className={`rounded-full px-3 py-2 transition-colors ${
                  locale === targetLocale
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "text-foreground/72 hover:bg-surface-soft hover:text-foreground"
                }`}
              >
                {targetLocale.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav className="flex flex-wrap items-center gap-1 rounded-[24px] border border-line bg-card px-2 py-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                currentHref === link.href
                  ? "bg-card-strong text-foreground shadow-sm"
                  : "text-foreground/72 hover:bg-surface-soft hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-line bg-card px-2 py-2 text-sm font-semibold md:flex">
            {(["de", "en"] as const).map((targetLocale) => (
              <Link
                key={targetLocale}
                href={toHref(targetLocale, pathSuffix)}
                className={`rounded-full px-3 py-2 transition-colors ${
                  locale === targetLocale
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "text-foreground/72 hover:bg-surface-soft hover:text-foreground"
                }`}
              >
                {targetLocale.toUpperCase()}
              </Link>
            ))}
          </div>
          <ThemeToggle dictionary={dictionary} />
        </div>
      </div>
    </header>
  );
}
