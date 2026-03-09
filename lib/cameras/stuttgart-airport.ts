import cameraSeeds from "../../data/seed/cameras.json";
import type { CameraAdapter, CameraDefinition } from "./types";

function getDefinitions() {
  return (cameraSeeds as CameraDefinition[]).filter((camera) => camera.configJson?.adapter === "stuttgart-airport");
}

export const stuttgartAirportAdapter: CameraAdapter = {
  key: "stuttgart-airport",
  async getCameraDefinitions() {
    return getDefinitions();
  },
  async fetchLatestSnapshot(camera) {
    return {
      ok: false,
      capturedAt: new Date().toISOString(),
      sourceUrl: camera.pageUrl,
      degradedReason:
        "Stuttgart Airport webcams are seeded as inactive because the official public webcam page is currently unavailable.",
    };
  },
  getAttribution(camera) {
    return `${camera.name} • Stuttgart Airport webcam page`;
  },
};
