import {
  getAverageValue,
  getCityAverageSeries,
  getDistrictPercentile,
  getLatestForCommunitySensor,
  getSeriesForCommunitySensor,
  getSeriesForDistrict,
  getSeriesForStation,
} from "@/lib/analytics";
import { formatFreshness, formatMetric, formatPercent } from "@/lib/format";
import type {
  AirQualityMeasurementRecord,
  AirQualityStationRecord,
  CommunityAirMeasurementRecord,
  CommunityAirSensorRecord,
  DistrictFeatureCollection,
  ExplorerSelection,
  Locale,
  Pollutant,
} from "@/lib/types";

export function getDistrictInsight(
  districtId: string,
  districts: DistrictFeatureCollection,
  stations: AirQualityStationRecord[],
  measurements: AirQualityMeasurementRecord[],
  pollutant: Pollutant,
  locale: Locale = "en",
) {
  const series = getSeriesForDistrict(measurements, stations, districtId, pollutant, locale);
  const cityAverage = getCityAverageSeries(measurements, pollutant, locale);

  if (series.length === 0 || cityAverage.length === 0) {
    return locale === "de"
      ? "Für diesen Bezirk liegen derzeit keine belastbaren offiziellen Messreihen vor."
      : "No reliable official time series is currently available for this district.";
  }

  const districtAverage = getAverageValue(series);
  const cityAverageValue = getAverageValue(cityAverage);
  const percentile = getDistrictPercentile(measurements, stations, districts, districtId, pollutant);

  if (districtAverage > cityAverageValue) {
    return locale === "de"
      ? `${pollutant} lag hier im Mittel bei ${formatMetric(districtAverage, "µg/m³", locale)}, über dem stadtweiten Wert von ${formatMetric(cityAverageValue, "µg/m³", locale)} und ungefähr im ${formatPercent(percentile, locale)}-Perzentil.`
      : `${pollutant} averaged ${formatMetric(districtAverage, "µg/m³", locale)} here, above the citywide ${formatMetric(cityAverageValue, "µg/m³", locale)} and around the ${formatPercent(percentile, locale)} percentile.`;
  }

  return locale === "de"
    ? `${pollutant} blieb hier mit ${formatMetric(districtAverage, "µg/m³", locale)} unter dem Stadtmittel und liegt damit ungefähr im ${formatPercent(percentile, locale)}-Perzentil.`
    : `${pollutant} stayed below the city average here at ${formatMetric(districtAverage, "µg/m³", locale)}, placing this district around the ${formatPercent(percentile, locale)} percentile.`;
}

export function getStationInsight(
  stationId: string,
  stations: AirQualityStationRecord[],
  measurements: AirQualityMeasurementRecord[],
  pollutant: Pollutant,
  locale: Locale = "en",
) {
  const station = stations.find((item) => item.id === stationId);
  const series = getSeriesForStation(measurements, stationId, pollutant, locale);
  const cityAverage = getCityAverageSeries(measurements, pollutant, locale);

  if (series.length === 0 || cityAverage.length === 0) {
    return locale === "de"
      ? "Für diese Station liegen derzeit keine belastbaren offiziellen Messreihen vor."
      : "No reliable official time series is currently available for this station.";
  }

  const average = getAverageValue(series);
  const cityAverageValue = getAverageValue(cityAverage);

  if (!station) {
    return locale === "de" ? "Für diese Station ist kein Kontext verfügbar." : "No station context available.";
  }

  if (average > cityAverageValue) {
    return locale === "de"
      ? `${station.name} lag über dem Stadtmittel und erreichte im Schnitt ${formatMetric(average, "µg/m³", locale)} gegenüber ${formatMetric(cityAverageValue, "µg/m³", locale)} stadtweit.`
      : `${station.name} ran hotter than the city baseline, averaging ${formatMetric(average, "µg/m³", locale)} versus ${formatMetric(cityAverageValue, "µg/m³", locale)} citywide.`;
  }

  return locale === "de"
    ? `${station.name} blieb sauberer als das Stadtmittel und lag im ausgewählten Zeitraum bei durchschnittlich ${formatMetric(average, "µg/m³", locale)}.`
    : `${station.name} stayed cleaner than the city baseline, averaging ${formatMetric(average, "µg/m³", locale)} across the selected period.`;
}

export function getSelectionInsight(
  selection: ExplorerSelection | null,
  districts: DistrictFeatureCollection,
  stations: AirQualityStationRecord[],
  measurements: AirQualityMeasurementRecord[],
  pollutant: Pollutant,
  communitySensors: CommunityAirSensorRecord[] = [],
  communityMeasurements: CommunityAirMeasurementRecord[] = [],
  locale: Locale = "en",
) {
  if (!selection) {
    return locale === "de"
      ? "Wähle einen Bezirk, eine Station oder einen Baustellenpunkt, um eine lokale Einordnung zu sehen."
      : "Select a district, station, or mobility marker to see a local story.";
  }

  if (selection.type === "district") {
    return getDistrictInsight(selection.id, districts, stations, measurements, pollutant, locale);
  }

  if (selection.type === "station") {
    return getStationInsight(selection.id, stations, measurements, pollutant, locale);
  }

  if (selection.type === "community") {
    const sensor = communitySensors.find((item) => item.id === selection.id);
    const latestPm25 = getLatestForCommunitySensor(communityMeasurements, selection.id, "PM2.5");
    const latestPm10 = getLatestForCommunitySensor(communityMeasurements, selection.id, "PM10");
    const pm25Series = getSeriesForCommunitySensor(communityMeasurements, selection.id, "PM2.5", locale);
    const change = pm25Series.length > 1 ? pm25Series.at(-1)!.value - pm25Series[0]!.value : 0;

    if (!sensor || !latestPm25) {
      return locale === "de"
        ? "Für diesen Community-Sensor sind aktuell keine belastbaren Feinstaubdaten verfügbar."
        : "No reliable particulate readings are currently available for this community sensor.";
    }

    if (latestPm10 && Math.abs(change) > 1) {
      return locale === "de"
        ? `${sensor.name} meldet zuletzt ${formatMetric(latestPm25.value, latestPm25.unit, locale)} PM2.5 und ${formatMetric(latestPm10.value, latestPm10.unit, locale)} PM10. Letzte Aktualisierung ${formatFreshness(latestPm25.timestamp, locale)}.`
        : `${sensor.name} last reported ${formatMetric(latestPm25.value, latestPm25.unit, locale)} PM2.5 and ${formatMetric(latestPm10.value, latestPm10.unit, locale)} PM10. Last update ${formatFreshness(latestPm25.timestamp, locale)}.`;
    }

    return locale === "de"
      ? `${sensor.name} liefert ergänzende Community-Messungen mit ${formatMetric(latestPm25.value, latestPm25.unit, locale)} PM2.5. Letzte Aktualisierung ${formatFreshness(latestPm25.timestamp, locale)}.`
      : `${sensor.name} provides supplementary community readings with ${formatMetric(latestPm25.value, latestPm25.unit, locale)} PM2.5. Last update ${formatFreshness(latestPm25.timestamp, locale)}.`;
  }

  if (selection.type === "parking") {
    return locale === "de"
      ? "Dieser Parkstandort zeigt öffentlich verfügbare Stellplatzdaten."
      : "This parking site shows publicly available parking-capacity data.";
  }

  if (selection.type === "transit") {
    return locale === "de"
      ? "Dieser Haltepunkt stammt aus dem öffentlichen GTFS-Fahrplandatensatz."
      : "This stop comes from the public GTFS schedule dataset.";
  }

  return locale === "de"
    ? "Dieser Mobilitätspunkt markiert eine lokale Störung. Wechsle in den Modus Move, um Sperrungen und Baustellen hervorzuheben."
    : "This mobility marker signals a local disruption; switch to Move mode to focus on closures and street works.";
}

export function getCompareInsight({
  leftLabel,
  rightLabel,
  leftAverage,
  rightAverage,
  pollutant,
  locale = "en",
}: {
  leftLabel: string;
  rightLabel: string;
  leftAverage: number;
  rightAverage: number;
  pollutant: Pollutant;
  locale?: Locale;
}) {
  const delta = Math.abs(leftAverage - rightAverage);

  if (delta < 1) {
    return locale === "de"
      ? `${leftLabel} und ${rightLabel} lagen bei ${pollutant} sehr nah beieinander; ihre Mittelwerte trennten weniger als 1 µg/m³.`
      : `${leftLabel} and ${rightLabel} tracked very closely for ${pollutant}, with less than 1 µg/m³ separating their averages.`;
  }

  const higher = leftAverage > rightAverage ? leftLabel : rightLabel;
  return locale === "de"
    ? `${higher} zeigte die höhere ${pollutant}-Belastung und lag im ausgewählten Zeitraum bei rund ${formatMetric(Math.max(leftAverage, rightAverage), "µg/m³", locale)}.`
    : `${higher} showed the heavier ${pollutant} burden, averaging about ${formatMetric(Math.max(leftAverage, rightAverage), "µg/m³", locale)} across the selected range.`;
}
