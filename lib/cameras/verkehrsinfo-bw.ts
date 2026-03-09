import cameraSeeds from "../../data/seed/cameras.json";
import type { CameraAdapter, CameraDefinition } from "./types";

function getDefinitions() {
  return (cameraSeeds as CameraDefinition[]).filter((camera) => camera.configJson?.adapter === "verkehrsinfo-bw");
}

export const verkehrsinfoBwAdapter: CameraAdapter = {
  key: "verkehrsinfo-bw",
  async getCameraDefinitions() {
    return getDefinitions();
  },
  async fetchLatestSnapshot(camera) {
    return {
      ok: false,
      capturedAt: new Date().toISOString(),
      sourceUrl: camera.pageUrl,
      degradedReason:
        "VerkehrsInfo BW traffic images are seeded as inactive because the official public camera pages are currently deactivated.",
    };
  },
  getAttribution(camera) {
    return `${camera.name} • VerkehrsInfo BW official camera notice`;
  },
};
