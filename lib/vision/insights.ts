import type { Locale, SceneCameraListItem, SceneMetricRecord } from "@/lib/types";
import { getAnomalyScore } from "./count";
import { toVisibilityPercent } from "./weather";

function formatPercentDelta(value: number, locale: Locale) {
  return `${value >= 0 ? "+" : ""}${Math.round(value * 100).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}%`;
}

export function getSceneInsight(camera: SceneCameraListItem, metrics: SceneMetricRecord[], locale: Locale) {
  if (!camera.active && camera.configJson?.statusReason) {
    return camera.configJson.statusReason;
  }

  const latestMetric = metrics[0] ?? camera.latestMetric;
  if (!latestMetric) {
    return locale === "de"
      ? "Für diese Kamera liegen noch keine abgeleiteten Szenenmetriken vor."
      : "No derived scene metrics are available for this camera yet.";
  }

  const anomalyScore = getAnomalyScore(metrics, latestMetric);
  if (typeof anomalyScore === "number" && Math.abs(anomalyScore) >= 0.15) {
    return locale === "de"
      ? `Der Fahrzeugfluss liegt ${formatPercentDelta(anomalyScore, locale)} gegenüber der jüngsten Werktags-Basislinie.`
      : `Vehicle flow is ${formatPercentDelta(anomalyScore, locale)} versus the recent weekday baseline.`;
  }

  if (metrics.length > 1) {
    const previousMetric = metrics[1];
    const currentVisibility = toVisibilityPercent(latestMetric.visibilityScore);
    const previousVisibility = toVisibilityPercent(previousMetric.visibilityScore);

    if (currentVisibility !== null && previousVisibility !== null && currentVisibility - previousVisibility <= -15) {
      return locale === "de"
        ? "Die Sichtbarkeit ist im Vergleich zur vorherigen Aufnahme deutlich gesunken."
        : "Visibility dropped sharply compared with the previous capture.";
    }
  }

  const weatherLabel = latestMetric.weatherLabel ?? "unknown";
  return locale === "de"
    ? `Zuletzt wurden ${latestMetric.vehicleCount} Fahrzeuge erkannt; Wetterstatus: ${weatherLabel}.`
    : `The latest frame detected ${latestMetric.vehicleCount} vehicles with ${weatherLabel} scene conditions.`;
}
