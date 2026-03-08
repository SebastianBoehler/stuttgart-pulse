import { notFound } from "next/navigation";
import { CompareShell } from "@/components/compare/compare-shell";
import { getAirQualityMeasurements, getAirQualityStations } from "@/lib/data/air-quality";
import { getCommunityAirMeasurements, getCommunityAirSensors } from "@/lib/data/community-air";
import { getDistricts } from "@/lib/data/districts";
import { getMobilityEvents } from "@/lib/data/mobility";
import { getParkingSites } from "@/lib/data/parking";
import { getTransitStops } from "@/lib/data/transit";
import { getDictionary, isLocale } from "@/lib/i18n";

export const dynamic = "force-static";

export default async function LocalizedComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const [districts, stations, measurements, communitySensors, communityMeasurements, mobilityEvents, parkingSites, transitStops] = await Promise.all([
    getDistricts(),
    getAirQualityStations(),
    getAirQualityMeasurements(),
    getCommunityAirSensors(),
    getCommunityAirMeasurements(),
    getMobilityEvents(),
    getParkingSites(),
    getTransitStops(),
  ]);
  const lastUpdated = measurements[measurements.length - 1]?.timestamp ?? communityMeasurements[communityMeasurements.length - 1]?.timestamp ?? null;

  return (
    <CompareShell
      locale={locale}
      dictionary={getDictionary(locale)}
      snapshot={{
        districts,
        stations,
        measurements,
        communitySensors,
        communityMeasurements,
        mobilityEvents,
        parkingSites,
        transitStops,
        lastUpdated,
      }}
    />
  );
}
