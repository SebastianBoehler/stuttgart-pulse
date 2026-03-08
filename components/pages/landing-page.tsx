import Link from "next/link";
import { ArrowUpRight, Bike, CloudFog, MapPinned } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const features = [
  {
    name: "Move",
    descriptionKey: "moveDescription" as const,
    ctaKey: "exploreMove" as const,
    href: "/explorer",
    icon: Bike,
  },
  {
    name: "Breathe",
    descriptionKey: "breatheDescription" as const,
    ctaKey: "exploreBreathe" as const,
    href: "/explorer",
    icon: CloudFog,
  },
  {
    name: "Compare",
    descriptionKey: "compareDescription" as const,
    ctaKey: "exploreCompare" as const,
    href: "/compare",
    icon: MapPinned,
  },
];

type LandingPageProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function LandingPage({ locale, dictionary }: LandingPageProps) {
  return (
    <div className="app-shell">
      <SiteHeader locale={locale} dictionary={dictionary} pathSuffix="" />
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-12 px-5 pb-16 pt-6 md:px-8 md:pb-24 md:pt-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-6">
            <Badge className="bg-accent-soft text-accent-strong">{dictionary.landing.badge}</Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl font-display text-5xl leading-[0.96] tracking-tight text-balance md:text-7xl">
                {dictionary.landing.hero}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">{dictionary.landing.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={`/${locale}/explorer`}>
                  {dictionary.common.openExplorer}
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href={`/${locale}/compare`}>{dictionary.common.seeCompareView}</Link>
              </Button>
            </div>
          </div>
          <div className="panel overflow-hidden rounded-[32px] border bg-card-strong p-6">
            <div className="grid min-h-[360px] gap-4 md:grid-cols-2">
              <div className="hero-gradient-panel rounded-[28px] p-6 text-white">
                <p className="text-sm uppercase tracking-[0.22em] text-white/60">{dictionary.landing.mapFirstLabel}</p>
                <p className="mt-16 max-w-xs font-display text-3xl leading-tight">{dictionary.landing.mapFirstText}</p>
              </div>
              <div className="surface-warm flex flex-col justify-between rounded-[28px] border border-line p-6">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.22em] text-muted">{dictionary.landing.storiesLabel}</p>
                  <p className="font-display text-3xl leading-tight">{dictionary.landing.storiesText}</p>
                </div>
                <div className="surface-soft rounded-2xl p-4 text-sm leading-6 text-muted">
                  {dictionary.landing.storySample}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {features.map(({ name, descriptionKey, ctaKey, href, icon: Icon }) => (
            <Card key={name} className="rounded-[28px]">
              <CardHeader className="space-y-5">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="font-display text-3xl">{name}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted">
                    {dictionary.landing[descriptionKey]}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="px-0 text-accent-strong">
                  <Link href={`/${locale}${href}`}>{dictionary.landing[ctaKey]}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
