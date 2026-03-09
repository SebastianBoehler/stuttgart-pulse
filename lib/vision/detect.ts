import type { SceneMetricRecord } from "@/lib/types";

export const VEHICLE_CLASS_NAMES = ["car", "truck", "bus", "motorcycle", "bicycle"] as const;

export type VehicleClassName = (typeof VEHICLE_CLASS_NAMES)[number];

export type VehicleDetection = {
  className: VehicleClassName;
  confidence: number;
  bbox: [number, number, number, number];
  trackId: number | null;
};

export type WorkerDetectionPayload = {
  detections: VehicleDetection[];
  counts: Pick<
    SceneMetricRecord,
    "vehicleCount" | "carCount" | "truckCount" | "busCount" | "bikeCount" | "motorcycleCount"
  >;
};

export function isVehicleClassName(value: string): value is VehicleClassName {
  return (VEHICLE_CLASS_NAMES as readonly string[]).includes(value);
}

export function sanitizeDetections(detections: Array<Record<string, unknown>>) {
  return detections
    .map((entry) => {
      const className = typeof entry.className === "string" ? entry.className : "";
      if (!isVehicleClassName(className)) {
        return null;
      }

      const bbox = Array.isArray(entry.bbox) ? entry.bbox : [];
      if (bbox.length !== 4 || !bbox.every((value) => typeof value === "number")) {
        return null;
      }

      return {
        className,
        confidence: typeof entry.confidence === "number" ? entry.confidence : 0,
        bbox: bbox as [number, number, number, number],
        trackId: typeof entry.trackId === "number" ? entry.trackId : null,
      } satisfies VehicleDetection;
    })
    .filter((entry): entry is VehicleDetection => entry !== null);
}
