import type { SceneConfig } from "@/lib/types";

export type NormalizedPolygon = Array<[number, number]>;

export function getMaskPolygons(config: SceneConfig | null | undefined) {
  return (config?.roiMasks ?? []).filter((polygon): polygon is NormalizedPolygon => Array.isArray(polygon));
}

export function getCountLine(config: SceneConfig | null | undefined) {
  return config?.countLine ?? null;
}

export function getCountZone(config: SceneConfig | null | undefined) {
  return config?.countZone ?? null;
}
