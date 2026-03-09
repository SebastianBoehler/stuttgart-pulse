import { stuttgartAirportAdapter } from "./stuttgart-airport";
import { stuttgartCityAdapter } from "./stuttgart-city";
import type { CameraAdapter, CameraDefinition } from "./types";
import { verkehrsinfoBwAdapter } from "./verkehrsinfo-bw";

export const cameraAdapters: Record<string, CameraAdapter> = {
  "verkehrsinfo-bw": verkehrsinfoBwAdapter,
  "stuttgart-city": stuttgartCityAdapter,
  "stuttgart-airport": stuttgartAirportAdapter,
};

export function getCameraAdapter(key: string) {
  return cameraAdapters[key] ?? null;
}

export async function getAllCameraDefinitions() {
  const groups = await Promise.all(Object.values(cameraAdapters).map((adapter) => adapter.getCameraDefinitions()));
  return groups.flat();
}

export function getCameraAttribution(camera: CameraDefinition) {
  const adapter = getCameraAdapter(camera.configJson?.adapter ?? "");
  return adapter?.getAttribution(camera) ?? camera.name;
}
