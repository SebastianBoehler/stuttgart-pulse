import type { SceneWeatherLabel } from "@/lib/types";

export function normalizeVisibilityScore(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

export function toVisibilityPercent(value: number | null | undefined) {
  const normalized = normalizeVisibilityScore(value);
  return normalized === null ? null : Math.round(normalized * 100);
}

export function getWeatherTone(label: SceneWeatherLabel | null | undefined) {
  switch (label) {
    case "clear":
      return "Clear";
    case "cloudy":
      return "Cloudy";
    case "foggy":
      return "Foggy";
    case "rainy":
      return "Rainy";
    case "night":
      return "Night";
    default:
      return "Unknown";
  }
}
