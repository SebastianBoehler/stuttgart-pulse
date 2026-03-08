import Link from "next/link";
import { Database, ExternalLink, Map, Wind } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const sources = [
  {
    name: "OpenData Stuttgart",
    href: "https://opendata.stuttgart.de/",
    descriptionEn: "City open-data portal used as the reference point for district and local context datasets.",
    descriptionDe: "Offenes Datenportal der Stadt Stuttgart und Referenzquelle für Bezirks- und Kontextdaten.",
    icon: Map,
  },
  {
    name: "Umweltbundesamt Luftdaten",
    href: "https://www.umweltbundesamt.de/daten/luft/luftdaten/doc",
    descriptionEn: "Official documentation for Germany’s federal air-quality data interfaces and measurement semantics.",
    descriptionDe: "Offizielle Dokumentation der Luftdaten-Schnittstellen des Bundes und ihrer Messlogik.",
    icon: Wind,
  },
  {
    name: "Stuttgart GeoServer",
    href: "https://geoserver.stuttgart.de/gdc/wfs",
    descriptionEn: "Official Stuttgart geodata endpoint used here for current and planned roadworks.",
    descriptionDe: "Offizieller Stuttgarter Geodaten-Endpunkt, hier für aktuelle und geplante Baustellen genutzt.",
    icon: Database,
  },
  {
    name: "MobiData BW",
    href: "https://api.mobidata-bw.de/",
    descriptionEn: "Public mobility platform used here for parking-site availability and GTFS transit-stop data.",
    descriptionDe: "Öffentliche Mobilitätsplattform, hier für Parkverfügbarkeit und GTFS-Haltepunkte genutzt.",
    icon: Database,
  },
];

type AboutPageContentProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function AboutPageContent({ locale, dictionary }: AboutPageContentProps) {
  return (
    <div className="app-shell">
      <SiteHeader locale={locale} dictionary={dictionary} pathSuffix="/about" />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-12 md:px-8">
        <Card className="rounded-[32px]">
          <CardHeader className="gap-4">
            <Badge className="bg-accent-soft text-accent-strong">{dictionary.about.badge}</Badge>
            <CardTitle className="font-display text-5xl leading-tight">{dictionary.about.title}</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">{dictionary.about.intro}</CardDescription>
          </CardHeader>
        </Card>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {sources.map(({ name, href, descriptionEn, descriptionDe, icon: Icon }) => (
            <Card key={name} className="rounded-[28px]">
              <CardHeader>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="font-display text-3xl">{name}</CardTitle>
                <CardDescription className="leading-6">{locale === "de" ? descriptionDe : descriptionEn}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={href} target="_blank" rel="noreferrer">
                    {dictionary.about.sourceButton}
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card className="rounded-[28px]">
            <CardHeader>
              <CardTitle className="font-display text-3xl">{dictionary.about.metricNotes}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted">
              <p>{dictionary.about.metricNote1}</p>
              <p>{dictionary.about.metricNote2}</p>
              <p>{dictionary.about.metricNote3}</p>
            </CardContent>
          </Card>

          <Card className="rounded-[28px]">
            <CardHeader>
              <CardTitle className="font-display text-3xl">{dictionary.about.caveats}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted">
              <p>{dictionary.about.caveat1}</p>
              <p>{dictionary.about.caveat2}</p>
              <p>{dictionary.about.caveat3}</p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
