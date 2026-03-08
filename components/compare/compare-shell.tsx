"use client";

import { useState } from "react";
import { ArrowLeftRight, ChartSpline } from "lucide-react";
import {
  filterMeasurementsByRange,
  getAverageValue,
  getChangePercent,
  getCityAverageSeries,
  getSeriesForDistrict,
  getSeriesForStation,
} from "@/lib/analytics";
import { formatMetric, formatPercent, formatRangeLabel } from "@/lib/format";
import { getCompareInsight } from "@/lib/insights";
import type { Locale, ExplorerSnapshot } from "@/lib/types";
import { MetricLineChart } from "@/components/charts/metric-line-chart";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";

const rangeOptions = [7, 14, 21];

function mergeSeries(
  leftSeries: Array<{ timestamp: string; label: string; value: number }>,
  rightSeries: Array<{ timestamp: string; label: string; value: number }>,
) {
  const rightMap = new Map(rightSeries.map((point) => [point.timestamp, point.value]));

  return leftSeries.map((point) => ({
    timestamp: point.timestamp,
    label: point.label,
    left: point.value,
    right: rightMap.get(point.timestamp) ?? null,
  }));
}

function getLatestValue(series: Array<{ value: number }>) {
  return series[series.length - 1]?.value ?? 0;
}

function formatMetricOrEmpty(value: number | null, locale: Locale) {
  return value === null ? "—" : formatMetric(value, "µg/m³", locale);
}

type CompareShellProps = {
  snapshot: ExplorerSnapshot;
  locale: Locale;
  dictionary: Dictionary;
};

export function CompareShell({ snapshot, locale, dictionary }: CompareShellProps) {
  const [compareType, setCompareType] = useState<"district" | "station">("district");
  const [rangeDays, setRangeDays] = useState(14);
  const filteredMeasurements = filterMeasurementsByRange(snapshot.measurements, rangeDays);

  const districtOptions = snapshot.districts.features.map((feature) => ({
    id: feature.properties.id,
    label: feature.properties.name,
  }));
  const stationOptions = snapshot.stations.map((station) => ({
    id: station.id,
    label: station.name,
  }));

  const [leftId, setLeftId] = useState(districtOptions[0]?.id ?? "");
  const [rightId, setRightId] = useState("city-average");

  const options = compareType === "district" ? districtOptions : stationOptions;

  const leftSeries =
    compareType === "district"
      ? getSeriesForDistrict(filteredMeasurements, snapshot.stations, leftId, "PM2.5", locale)
      : getSeriesForStation(filteredMeasurements, leftId, "PM2.5", locale);

  const rightSeries =
    compareType === "district"
      ? rightId === "city-average"
        ? getCityAverageSeries(filteredMeasurements, "PM2.5", locale)
        : getSeriesForDistrict(filteredMeasurements, snapshot.stations, rightId, "PM2.5", locale)
      : getSeriesForStation(filteredMeasurements, rightId, "PM2.5", locale);

  const leftLabel = options.find((option) => option.id === leftId)?.label ?? dictionary.common.selectionA;
  const rightLabel =
    compareType === "district" && rightId === "city-average"
      ? dictionary.common.cityAverage
      : options.find((option) => option.id === rightId)?.label ?? dictionary.common.selectionB;
  const leftAverage = getAverageValue(leftSeries);
  const rightAverage = getAverageValue(rightSeries);
  const hasComparisonData = leftSeries.length > 0 && rightSeries.length > 0;
  const insight = hasComparisonData
    ? getCompareInsight({
        leftLabel,
        rightLabel,
        leftAverage,
        rightAverage,
        pollutant: "PM2.5",
        locale,
      })
    : dictionary.compare.noComparisonData;

  return (
    <div className="app-shell">
      <SiteHeader locale={locale} dictionary={dictionary} pathSuffix="/compare" />
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-8 md:px-8">
        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-[28px]">
            <CardHeader>
              <Badge className="bg-accent-soft text-accent-strong">{dictionary.compare.badge}</Badge>
              <CardTitle className="font-display text-4xl leading-tight">{dictionary.compare.title}</CardTitle>
              <CardDescription className="leading-6">{dictionary.compare.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dictionary.compare.compareType}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={compareType === "district" ? "default" : "outline"}
                    onClick={() => {
                      setCompareType("district");
                      setLeftId(districtOptions[0]?.id ?? "");
                      setRightId("city-average");
                    }}
                  >
                    {dictionary.common.districts}
                  </Button>
                  <Button
                    variant={compareType === "station" ? "default" : "outline"}
                    onClick={() => {
                      setCompareType("station");
                      setLeftId(stationOptions[0]?.id ?? "");
                      setRightId(stationOptions[1]?.id ?? stationOptions[0]?.id ?? "");
                    }}
                  >
                    {dictionary.common.stations}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted" htmlFor="left-select">
                    {dictionary.common.selectionA}
                  </label>
                  <select
                    id="left-select"
                    value={leftId}
                    onChange={(event) => setLeftId(event.target.value)}
                    className="surface-soft w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none"
                  >
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted" htmlFor="right-select">
                    {dictionary.common.selectionB}
                  </label>
                  <select
                    id="right-select"
                    value={rightId}
                    onChange={(event) => setRightId(event.target.value)}
                    className="surface-soft w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none"
                  >
                    {compareType === "district" ? <option value="city-average">{dictionary.common.cityAverage}</option> : null}
                    {options
                      .filter((option) => option.id !== leftId || compareType === "district")
                      .map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dictionary.common.selectedRange}</p>
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
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-[28px]">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge className="badge-soft mb-3">{dictionary.common.pm25Comparison}</Badge>
                    <CardTitle className="font-display text-4xl leading-tight">{leftLabel} vs {rightLabel}</CardTitle>
                    <CardDescription className="mt-2 leading-6">{insight}</CardDescription>
                  </div>
                  <div className="rounded-full bg-accent-soft px-4 py-3 text-sm font-semibold text-accent-strong">
                    <span className="inline-flex items-center gap-2">
                      <ArrowLeftRight className="size-4" />
                      {formatRangeLabel(rangeDays, locale)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                <div className="surface-soft rounded-[24px] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{leftLabel}</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {formatMetricOrEmpty(leftSeries.length > 0 ? getLatestValue(leftSeries) : null, locale)}
                  </p>
                  <p className="mt-3 text-sm text-muted">
                    {locale === "de" ? "Durchschnitt" : "Average"} {formatMetricOrEmpty(leftSeries.length > 0 ? leftAverage : null, locale)} •{" "}
                    {locale === "de" ? "Änderung" : "Change"} {hasComparisonData ? formatPercent(getChangePercent(leftSeries), locale) : "—"}
                  </p>
                </div>
                <div className="surface-soft rounded-[24px] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{rightLabel}</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {formatMetricOrEmpty(rightSeries.length > 0 ? getLatestValue(rightSeries) : null, locale)}
                  </p>
                  <p className="mt-3 text-sm text-muted">
                    {locale === "de" ? "Durchschnitt" : "Average"} {formatMetricOrEmpty(rightSeries.length > 0 ? rightAverage : null, locale)} •{" "}
                    {locale === "de" ? "Änderung" : "Change"} {hasComparisonData ? formatPercent(getChangePercent(rightSeries), locale) : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px]">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ChartSpline className="size-5 text-accent" />
                  <CardTitle className="font-display text-2xl">{dictionary.common.sharedLineChart}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {hasComparisonData ? (
                  <MetricLineChart
                    data={mergeSeries(leftSeries, rightSeries)}
                    lines={[
                      { dataKey: "left", name: leftLabel, color: "#1f6f63" },
                      { dataKey: "right", name: rightLabel, color: "#cf7a2d" },
                    ]}
                    height={280}
                    locale={locale}
                  />
                ) : (
                  <div className="surface-soft flex min-h-[280px] items-center rounded-[24px] p-6 text-sm leading-6 text-muted">
                    {dictionary.compare.noComparisonData}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
