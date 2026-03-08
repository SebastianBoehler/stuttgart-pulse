import type {
  AirQualityMeasurementRecord,
  AirQualityStationRecord,
  ChartPoint,
  CommunityAirMeasurementRecord,
  DistrictFeatureCollection,
  Locale,
  MobilityEventRecord,
  Pollutant,
} from "@/lib/types";
import { formatDateLabel } from "@/lib/format";

export function filterMeasurementsByRange<T extends { timestamp: string }>(measurements: T[], days: number) {
  if (measurements.length === 0) {
    return measurements;
  }

  const timestamps = measurements.map((item) => new Date(item.timestamp).getTime());
  const maxTimestamp = Math.max(...timestamps);
  const cutoff = maxTimestamp - days * 24 * 60 * 60 * 1000;

  return measurements.filter((item) => new Date(item.timestamp).getTime() >= cutoff);
}

export function getLatestForStation(
  measurements: AirQualityMeasurementRecord[],
  stationId: string,
  pollutant: Pollutant,
) {
  return [...measurements]
    .filter((item) => item.stationId === stationId && item.pollutant === pollutant)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())[0];
}

export function getSeriesForStation(
  measurements: AirQualityMeasurementRecord[],
  stationId: string,
  pollutant: Pollutant,
  locale: Locale = "en",
): ChartPoint[] {
  return measurements
    .filter((item) => item.stationId === stationId && item.pollutant === pollutant)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .map((item) => ({
      timestamp: item.timestamp,
      label: formatDateLabel(item.timestamp, locale),
      value: item.value,
    }));
}

export function getLatestForCommunitySensor(
  measurements: CommunityAirMeasurementRecord[],
  sensorId: string,
  pollutant: CommunityAirMeasurementRecord["pollutant"],
) {
  return [...measurements]
    .filter((item) => item.sensorId === sensorId && item.pollutant === pollutant)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())[0];
}

export function getSeriesForCommunitySensor(
  measurements: CommunityAirMeasurementRecord[],
  sensorId: string,
  pollutant: CommunityAirMeasurementRecord["pollutant"],
  locale: Locale = "en",
): ChartPoint[] {
  return measurements
    .filter((item) => item.sensorId === sensorId && item.pollutant === pollutant)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .map((item) => ({
      timestamp: item.timestamp,
      label: formatDateLabel(item.timestamp, locale),
      value: item.value,
    }));
}

function averageRows(rows: AirQualityMeasurementRecord[]) {
  if (rows.length === 0) {
    return 0;
  }

  return rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
}

function aggregateByTimestamp(rows: AirQualityMeasurementRecord[]) {
  const grouped = new Map<string, AirQualityMeasurementRecord[]>();

  rows.forEach((row) => {
    const bucket = grouped.get(row.timestamp) ?? [];
    bucket.push(row);
    grouped.set(row.timestamp, bucket);
  });

  return [...grouped.entries()]
    .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
    .map(([timestamp, bucket]) => ({
      timestamp,
      label: formatDateLabel(timestamp),
      value: averageRows(bucket),
    }));
}

export function getSeriesForDistrict(
  measurements: AirQualityMeasurementRecord[],
  stations: AirQualityStationRecord[],
  districtId: string,
  pollutant: Pollutant,
  locale: Locale = "en",
) {
  const stationIds = new Set(stations.filter((station) => station.districtId === districtId).map((station) => station.id));

  return aggregateByTimestamp(
    measurements.filter((measurement) => stationIds.has(measurement.stationId) && measurement.pollutant === pollutant),
  ).map((point) => ({
    ...point,
    label: formatDateLabel(point.timestamp, locale),
  }));
}

export function getCityAverageSeries(
  measurements: AirQualityMeasurementRecord[],
  pollutant: Pollutant,
  locale: Locale = "en",
) {
  return aggregateByTimestamp(measurements.filter((measurement) => measurement.pollutant === pollutant)).map((point) => ({
    ...point,
    label: formatDateLabel(point.timestamp, locale),
  }));
}

export function getAverageValue(series: ChartPoint[]) {
  if (series.length === 0) {
    return 0;
  }

  return series.reduce((sum, point) => sum + point.value, 0) / series.length;
}

export function getChangePercent(series: ChartPoint[]) {
  if (series.length < 2) {
    return 0;
  }

  const first = series[0]?.value ?? 0;
  const last = series.at(-1)?.value ?? 0;

  if (first === 0) {
    return 0;
  }

  return ((last - first) / first) * 100;
}

export function getDistrictLatestValue(
  measurements: AirQualityMeasurementRecord[],
  stations: AirQualityStationRecord[],
  districtId: string,
  pollutant: Pollutant,
) {
  const series = getSeriesForDistrict(measurements, stations, districtId, pollutant);
  return series.at(-1)?.value ?? 0;
}

export function getDistrictPercentile(
  measurements: AirQualityMeasurementRecord[],
  stations: AirQualityStationRecord[],
  districts: DistrictFeatureCollection,
  districtId: string,
  pollutant: Pollutant,
) {
  const latestValues = districts.features
    .map((feature) => getDistrictLatestValue(measurements, stations, feature.properties.id, pollutant))
    .sort((left, right) => left - right);
  const current = getDistrictLatestValue(measurements, stations, districtId, pollutant);
  const rank = latestValues.findIndex((value) => value >= current);

  if (rank < 0 || latestValues.length === 0) {
    return 0;
  }

  return ((rank + 1) / latestValues.length) * 100;
}

export function getActiveMobilityCount(events: MobilityEventRecord[], districtId: string) {
  return events.filter((event) => event.districtId === districtId).length;
}

export function getMapDistrictFill(
  districtId: string,
  mode: "move" | "breathe",
  measurements: AirQualityMeasurementRecord[],
  stations: AirQualityStationRecord[],
  events: MobilityEventRecord[],
) {
  if (mode === "move") {
    const count = getActiveMobilityCount(events, districtId);
    if (count >= 2) return "#cf7a2d";
    if (count === 1) return "#f1c087";
    return "#ece5d8";
  }

  const value = getDistrictLatestValue(measurements, stations, districtId, "PM2.5");
  if (value >= 17) return "#b64d5d";
  if (value >= 13) return "#cf7a2d";
  if (value >= 10) return "#8ab4a8";
  return "#dcece6";
}
