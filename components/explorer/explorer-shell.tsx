"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Bike, CloudFog, Layers3, MapPin, TrendingUp, Waves } from "lucide-react";
import {
  filterMeasurementsByRange,
  getActiveMobilityCount,
  getAverageValue,
  getChangePercent,
  getCityAverageSeries,
  getDistrictLatestValue,
  getLatestForCommunitySensor,
  getSeriesForCommunitySensor,
  getSeriesForDistrict,
  getSeriesForStation,
} from "@/lib/analytics";
import {
  formatDateTime,
  formatDistrictLabel,
  formatFreshness,
  formatMetric,
  formatPercent,
  formatRangeLabel,
} from "@/lib/format";
import { getSelectionInsight } from "@/lib/insights";
import type { Dictionary } from "@/lib/i18n";
import type { CommunityAirMeasurementRecord, Locale, ExplorerSelection, ExplorerSnapshot, Pollutant } from "@/lib/types";
import { MetricLineChart } from "@/components/charts/metric-line-chart";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ExplorerMap = dynamic(() => import("@/components/map/explorer-map").then((module) => module.ExplorerMap), {
  ssr: false,
  loading: () => <div className="surface-soft h-full min-h-[420px] animate-pulse rounded-[28px]" />,
});

const rangeOptions = [7, 14, 21];

function mergeSeries(localSeries: Array<{ timestamp: string; label: string; value: number }>, comparisonSeries: Array<{ timestamp: string; label: string; value: number }>) {
  const comparisonMap = new Map(comparisonSeries.map((point) => [point.timestamp, point.value]));

  return localSeries.map((point) => ({
    timestamp: point.timestamp,
    label: point.label,
    value: point.value,
    comparison: comparisonMap.get(point.timestamp) ?? null,
  }));
}

function getLatestValue(series: Array<{ value: number }>) {
  return series[series.length - 1]?.value ?? 0;
}

function formatMetricOrEmpty(value: number | null, locale: Locale) {
  return value === null ? "—" : formatMetric(value, "µg/m³", locale);
}

function getLatestCommunityTimestamp(measurements: CommunityAirMeasurementRecord[], sensorId: string) {
  return [...measurements]
    .filter((item) => item.sensorId === sensorId)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())[0]?.timestamp;
}

type ExplorerShellProps = {
  snapshot: ExplorerSnapshot;
  locale: Locale;
  dictionary: Dictionary;
};

export function ExplorerShell({ snapshot, locale, dictionary }: ExplorerShellProps) {
  const [mode, setMode] = useState<"move" | "breathe">("breathe");
  const [rangeDays, setRangeDays] = useState(14);
  const [layers, setLayers] = useState({
    districts: true,
    officialAir: true,
    communityAir: false,
    mobility: true,
    parking: false,
    transit: false,
  });
  const [selection, setSelection] = useState<ExplorerSelection | null>(() => {
    const firstDistrict = snapshot.districts.features[0]?.properties.id;
    return firstDistrict ? { type: "district", id: firstDistrict } : null;
  });

  const filteredMeasurements = filterMeasurementsByRange(snapshot.measurements, rangeDays);
  const filteredCommunityMeasurements = filterMeasurementsByRange(snapshot.communityMeasurements, rangeDays);
  const citySeries = getCityAverageSeries(filteredMeasurements, "PM2.5", locale);
  const cityNo2Series = getCityAverageSeries(filteredMeasurements, "NO2", locale);
  const cityPm25Average = getAverageValue(citySeries);
  const cityNo2Average = getAverageValue(cityNo2Series);
  const hasOfficialData =
    snapshot.districts.features.length > 0 ||
    snapshot.stations.length > 0 ||
    snapshot.measurements.length > 0 ||
    snapshot.mobilityEvents.length > 0 ||
    snapshot.parkingSites.length > 0 ||
    snapshot.transitStops.length > 0;
  const hasOfficialAirSeries = citySeries.length > 0;

  let title: string = dictionary.explorer.cityOverview;
  let subtitle: string = "Stuttgart";
  let pollutant: Pollutant = "PM2.5";
  let primarySeries = citySeries;
  let comparisonSeries: Array<{ timestamp: string; label: string; value: number }> | null = citySeries;
  let statCards: Array<{ label: string; value: string | number }> = [
    {
      label: dictionary.explorer.latestPm25,
      value: citySeries.length > 0 ? formatMetric(getLatestValue(citySeries), "µg/m³", locale) : "—",
    },
    {
      label: dictionary.explorer.latestNo2,
      value: cityNo2Series.length > 0 ? formatMetric(getLatestValue(cityNo2Series), "µg/m³", locale) : "—",
    },
    { label: dictionary.explorer.mobilityEvents, value: snapshot.mobilityEvents.length },
  ];
  let sourceBadge = subtitle;
  let detailNote: string | null = null;
  let trendDescription = `${formatRangeLabel(rangeDays, locale)} ${dictionary.explorer.trendDescription}`;

  if (selection?.type === "district") {
    const district = snapshot.districts.features.find((feature) => feature.properties.id === selection.id);
    if (district) {
      title = district.properties.name;
      subtitle = district.properties.areaLabel ?? formatDistrictLabel(district.properties.districtNumber, locale);
      sourceBadge = subtitle;
      primarySeries = getSeriesForDistrict(filteredMeasurements, snapshot.stations, district.properties.id, "PM2.5", locale);
      comparisonSeries = citySeries;
      statCards = [
        {
          label: dictionary.explorer.latestPm25,
          value: primarySeries.length > 0
            ? formatMetric(
                getDistrictLatestValue(filteredMeasurements, snapshot.stations, district.properties.id, "PM2.5"),
                "µg/m³",
                locale,
              )
            : "—",
        },
        {
          label: dictionary.explorer.latestNo2,
          value:
            getSeriesForDistrict(filteredMeasurements, snapshot.stations, district.properties.id, "NO2", locale).length > 0
              ? formatMetric(
                  getDistrictLatestValue(filteredMeasurements, snapshot.stations, district.properties.id, "NO2"),
                  "µg/m³",
                  locale,
                )
              : "—",
        },
        {
          label: dictionary.explorer.mobilityEvents,
          value: getActiveMobilityCount(snapshot.mobilityEvents, district.properties.id),
        },
      ];
    }
  } else if (selection?.type === "station") {
    const station = snapshot.stations.find((item) => item.id === selection.id);
    if (station) {
      title = station.name;
      subtitle = station.source;
      sourceBadge = dictionary.common.officialStations;
      primarySeries = getSeriesForStation(filteredMeasurements, station.id, "PM2.5", locale);
      comparisonSeries = citySeries;
      statCards = [
        {
          label: dictionary.explorer.latestPm25,
          value: primarySeries.length > 0 ? formatMetric(getLatestValue(primarySeries), "µg/m³", locale) : "—",
        },
        {
          label: dictionary.explorer.latestNo2,
          value:
            getSeriesForStation(filteredMeasurements, station.id, "NO2", locale).length > 0
              ? formatMetric(
                  getLatestValue(getSeriesForStation(filteredMeasurements, station.id, "NO2", locale)),
                  "µg/m³",
                  locale,
                )
              : "—",
        },
        { label: dictionary.explorer.nearbyDisruptions, value: getActiveMobilityCount(snapshot.mobilityEvents, station.districtId) },
      ];
    }
  } else if (selection?.type === "community") {
    const sensor = snapshot.communitySensors.find((item) => item.id === selection.id);
    const pm25 = getLatestForCommunitySensor(filteredCommunityMeasurements, selection.id, "PM2.5");
    const pm10 = getLatestForCommunitySensor(filteredCommunityMeasurements, selection.id, "PM10");
    const communitySeries = getSeriesForCommunitySensor(filteredCommunityMeasurements, selection.id, "PM2.5", locale);
    const latestTimestamp = getLatestCommunityTimestamp(filteredCommunityMeasurements, selection.id);

    if (sensor) {
      title = sensor.name;
      subtitle = dictionary.explorer.communitySource;
      sourceBadge = dictionary.common.communitySensors;
      primarySeries = communitySeries;
      comparisonSeries = null;
      pollutant = "PM2.5";
      statCards = [
        {
          label: dictionary.explorer.latestPm25,
          value: pm25 ? formatMetric(pm25.value, pm25.unit, locale) : "—",
        },
        {
          label: dictionary.explorer.latestPm10,
          value: pm10 ? formatMetric(pm10.value, pm10.unit, locale) : "—",
        },
        {
          label: dictionary.common.freshness,
          value: latestTimestamp ? formatFreshness(latestTimestamp, locale) : "—",
        },
      ];
      detailNote = `${dictionary.common.source}: Sensor.Community • ${
        latestTimestamp
          ? `${dictionary.common.measuredAt} ${formatDateTime(latestTimestamp, locale)}`
          : dictionary.common.measuredAt
      }`;
      trendDescription = dictionary.explorer.communityTrendUnavailable;
    }
  } else if (selection?.type === "mobility") {
    const event = snapshot.mobilityEvents.find((item) => item.id === selection.id);
    if (event) {
      title = event.name;
      subtitle =
        locale === "de" ? `${event.type} • ${event.severity}-Priorität` : `${event.type} • ${event.severity} severity`;
      sourceBadge = subtitle;
      primarySeries = getSeriesForDistrict(filteredMeasurements, snapshot.stations, event.districtId, "PM2.5", locale);
      comparisonSeries = citySeries;
      statCards = [
        {
          label: dictionary.explorer.latestPm25,
          value: primarySeries.length > 0 ? formatMetric(getLatestValue(primarySeries), "µg/m³", locale) : "—",
        },
        {
          label: dictionary.explorer.latestNo2,
          value:
            getSeriesForDistrict(filteredMeasurements, snapshot.stations, event.districtId, "NO2", locale).length > 0
              ? formatMetric(
                  getDistrictLatestValue(filteredMeasurements, snapshot.stations, event.districtId, "NO2"),
                  "µg/m³",
                  locale,
                )
              : "—",
        },
        { label: dictionary.explorer.districtEvents, value: getActiveMobilityCount(snapshot.mobilityEvents, event.districtId) },
      ];
    }
  } else if (selection?.type === "parking") {
    const site = snapshot.parkingSites.find((item) => item.id === selection.id);
    if (site) {
      title = site.name;
      subtitle = site.type;
      sourceBadge = dictionary.common.parking;
      primarySeries = [];
      comparisonSeries = null;
      statCards = [
        {
          label: dictionary.explorer.availableSpaces,
          value: site.availableSpaces?.toLocaleString(locale === "de" ? "de-DE" : "en-GB") ?? "—",
        },
        {
          label: dictionary.explorer.capacity,
          value: site.capacity?.toLocaleString(locale === "de" ? "de-DE" : "en-GB") ?? "—",
        },
        {
          label: dictionary.common.freshness,
          value: site.lastUpdated ? formatFreshness(site.lastUpdated, locale) : "—",
        },
      ];
      detailNote = `${dictionary.common.source}: ${site.source}${
        site.address ? ` • ${site.address}` : ""
      }${site.lastUpdated ? ` • ${dictionary.common.updated} ${formatDateTime(site.lastUpdated, locale)}` : ""}`;
      trendDescription = dictionary.explorer.parkingTrendUnavailable;
    }
  } else if (selection?.type === "transit") {
    const stop = snapshot.transitStops.find((item) => item.id === selection.id);
    if (stop) {
      title = stop.name;
      subtitle = stop.locationType;
      sourceBadge = dictionary.common.transit;
      primarySeries = [];
      comparisonSeries = null;
      statCards = [
        {
          label: dictionary.explorer.platformCount,
          value: stop.platformCount,
        },
        {
          label: dictionary.explorer.mobilityEvents,
          value: getActiveMobilityCount(snapshot.mobilityEvents, stop.districtId),
        },
        {
          label: dictionary.explorer.parkingSites,
          value: snapshot.parkingSites.filter((site) => site.districtId === stop.districtId).length,
        },
      ];
      detailNote = `${dictionary.common.source}: ${stop.source}`;
      trendDescription = dictionary.explorer.transitTrendUnavailable;
    }
  }

  const chartData = comparisonSeries ? mergeSeries(primarySeries, comparisonSeries) : primarySeries.map((point) => ({
    timestamp: point.timestamp,
    label: point.label,
    value: point.value,
  }));
  let insight = getSelectionInsight(
    selection,
    snapshot.districts,
    snapshot.stations,
    filteredMeasurements,
    pollutant,
    snapshot.communitySensors,
    filteredCommunityMeasurements,
    locale,
  );
  if (selection?.type === "parking") {
    insight = dictionary.explorer.parkingInsight;
  } else if (selection?.type === "transit") {
    insight = dictionary.explorer.transitInsight;
  }
  const selectedChange = primarySeries.length > 1 ? getChangePercent(primarySeries) : 0;
  const hasTrendData = chartData.length > 0;
  const showTrendChart =
    hasTrendData &&
    selection?.type !== "parking" &&
    selection?.type !== "transit" &&
    (selection?.type !== "community" || primarySeries.length > 1);
  const summaryInsight = !hasOfficialData && selection?.type !== "community" ? dictionary.explorer.noOfficialData : insight;

  return (
    <div className="app-shell">
      <SiteHeader locale={locale} dictionary={dictionary} pathSuffix="/explorer" />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pb-8 md:px-8">
        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card className="rounded-[28px]">
              <CardHeader>
                <Badge className="bg-accent-soft text-accent-strong">{dictionary.explorer.badge}</Badge>
                <CardTitle className="font-display text-4xl leading-tight">{dictionary.explorer.title}</CardTitle>
                <CardDescription className="leading-6">{dictionary.explorer.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dictionary.explorer.mode}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={mode === "breathe" ? "default" : "outline"} onClick={() => setMode("breathe")}>
                      <CloudFog className="size-4" />
                      {dictionary.explorer.breathe}
                    </Button>
                    <Button variant={mode === "move" ? "default" : "outline"} onClick={() => setMode("move")}>
                      <Bike className="size-4" />
                      {dictionary.explorer.move}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dictionary.explorer.timeRange}</p>
                  <div className="flex flex-wrap gap-2">
                    {rangeOptions.map((option) => (
                      <Button
                        key={option}
                        size="sm"
                        variant={rangeDays === option ? "default" : "outline"}
                        onClick={() => setRangeDays(option)}
                      >
                        {formatRangeLabel(option, locale)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    <Layers3 className="size-4" />
                    {dictionary.explorer.layers}
                  </p>
                  <div className="grid gap-2">
                    {[
                      { key: "districts", label: dictionary.explorer.districtBoundaries },
                      { key: "officialAir", label: dictionary.common.officialStations },
                      { key: "communityAir", label: dictionary.common.communitySensors },
                      { key: "mobility", label: dictionary.explorer.mobilityEvents },
                      { key: "parking", label: dictionary.explorer.parkingSites },
                      { key: "transit", label: dictionary.explorer.transitStops },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setLayers((current) => ({
                            ...current,
                            [item.key]: !current[item.key as keyof typeof current],
                          }))
                        }
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                          layers[item.key as keyof typeof layers]
                            ? "border-accent bg-accent-soft text-accent-strong"
                            : "border-line bg-card-strong text-muted"
                        }`}
                      >
                        <span>{item.label}</span>
                        <span>{layers[item.key as keyof typeof layers] ? dictionary.common.on : dictionary.common.off}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="surface-inverse rounded-[28px]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">{dictionary.explorer.cityPulse}</CardTitle>
                <CardDescription className="surface-inverse-muted">{dictionary.explorer.cityPulseDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">{dictionary.explorer.averagePm25}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatMetricOrEmpty(hasOfficialAirSeries ? cityPm25Average : null, locale)}</p>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">{dictionary.explorer.averageNo2}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatMetricOrEmpty(cityNo2Series.length > 0 ? cityNo2Average : null, locale)}</p>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">{dictionary.explorer.liveDisruptions}</p>
                  <p className="mt-2 text-2xl font-semibold">{snapshot.mobilityEvents.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="panel overflow-hidden rounded-[32px] p-3">
            <div className="flex items-center justify-between px-3 pb-3 pt-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dictionary.explorer.mapLabel}</p>
                <p className="font-display text-3xl">
                  {mode === "breathe" ? dictionary.explorer.breathe : dictionary.explorer.move}{" "}
                  {locale === "de" ? "Modus" : "mode"}
                </p>
              </div>
              <Badge className="map-overlay text-foreground">
                {snapshot.lastUpdated
                  ? `${dictionary.common.updated} ${formatDateTime(snapshot.lastUpdated, locale)}`
                  : dictionary.common.noDataLoaded}
              </Badge>
            </div>
            <ExplorerMap
              districts={snapshot.districts}
              stations={snapshot.stations}
              measurements={filteredMeasurements}
              communitySensors={snapshot.communitySensors}
              communityMeasurements={filteredCommunityMeasurements}
              mobilityEvents={snapshot.mobilityEvents}
              parkingSites={snapshot.parkingSites}
              transitStops={snapshot.transitStops}
              layers={layers}
              mode={mode}
              selected={selection}
              onSelect={setSelection}
            />
          </div>

          <div className="space-y-4">
            <Card className="rounded-[28px]">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="badge-soft w-fit">{sourceBadge}</Badge>
                  {selection?.type === "community" ? (
                    <Badge className="bg-accent-soft text-accent-strong">{dictionary.explorer.communitySource}</Badge>
                  ) : null}
                </div>
                <CardTitle className="font-display text-4xl leading-tight">{title}</CardTitle>
                <CardDescription className="leading-6">{summaryInsight}</CardDescription>
                {detailNote ? <p className="text-sm text-muted">{detailNote}</p> : null}
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {statCards.map((card) => (
                  <div key={card.label} className="surface-soft rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">{card.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[28px]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl">{dictionary.explorer.trendTitle}</CardTitle>
                    <CardDescription>{trendDescription}</CardDescription>
                  </div>
                  <div className="rounded-full bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp className="size-4" />
                      {showTrendChart ? formatPercent(selectedChange, locale) : dictionary.common.freshness}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {showTrendChart ? (
                  <MetricLineChart
                    data={chartData}
                    lines={[
                      { dataKey: "value", name: title, color: "var(--accent)" },
                      ...(comparisonSeries
                        ? [{ dataKey: "comparison", name: dictionary.common.cityAverage, color: "var(--amber)" }]
                        : []),
                    ]}
                    locale={locale}
                  />
                ) : (
                  <div className="surface-soft flex min-h-[220px] flex-col items-start justify-center gap-3 rounded-[24px] p-6 text-sm leading-6 text-muted">
                    <Waves className="size-5 text-accent" />
                    <p>
                      {selection?.type === "community"
                        ? dictionary.explorer.communityTrendUnavailable
                        : selection?.type === "parking"
                          ? dictionary.explorer.parkingTrendUnavailable
                          : selection?.type === "transit"
                            ? dictionary.explorer.transitTrendUnavailable
                            : dictionary.explorer.noTrendData}
                    </p>
                    <p>
                      {selection?.type === "community"
                        ? dictionary.explorer.communityCaveat
                        : selection?.type === "parking"
                          ? dictionary.explorer.parkingCaveat
                          : selection?.type === "transit"
                            ? dictionary.explorer.transitCaveat
                            : dictionary.explorer.noOfficialData}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">{dictionary.explorer.readingNotes}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted">
                <p className="surface-soft rounded-2xl p-4">{dictionary.explorer.note1}</p>
                <p className="surface-soft rounded-2xl p-4">{dictionary.explorer.note2}</p>
                {snapshot.communitySensors.length > 0 ? (
                  <p className="surface-soft rounded-2xl p-4">{dictionary.explorer.communityCaveat}</p>
                ) : null}
                <p className="surface-soft flex items-center gap-2 rounded-2xl p-4">
                  <MapPin className="size-4 text-accent" />
                  {dictionary.explorer.note3}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
