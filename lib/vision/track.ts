import type { VehicleClassName } from "./detect";

export type TrackerMode = "botsort" | "bytetrack";

export type TrackingConfig = {
  mode: TrackerMode;
  confidenceThreshold: number;
  iouThreshold: number;
  persistFrames: number;
  classes: VehicleClassName[];
};

// Person tracking is intentionally excluded from the allowed class list.
export const defaultTrackingConfig: TrackingConfig = {
  mode: "botsort",
  confidenceThreshold: 0.3,
  iouThreshold: 0.5,
  persistFrames: 8,
  classes: ["car", "truck", "bus", "motorcycle", "bicycle"],
};
