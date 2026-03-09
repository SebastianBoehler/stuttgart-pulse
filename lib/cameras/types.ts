import type { SceneCameraRecord, SceneConfig } from "@/lib/types";

export type CameraDefinition = Omit<SceneCameraRecord, "id">;

export type SnapshotFetchResult =
  | {
      ok: true;
      capturedAt: string;
      sourceUrl: string | null;
      contentType: string | null;
      imageBuffer: Buffer;
      hash: string;
    }
  | {
      ok: false;
      capturedAt: string;
      sourceUrl: string | null;
      degradedReason: string;
      hash?: string;
    };

export type CameraAdapter = {
  key: SceneConfig["adapter"];
  getCameraDefinitions: () => Promise<CameraDefinition[]>;
  fetchLatestSnapshot: (camera: CameraDefinition) => Promise<SnapshotFetchResult>;
  getAttribution: (camera: CameraDefinition) => string;
};
