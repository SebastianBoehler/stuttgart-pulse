import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Locale, SceneCameraListItem, SceneCameraRecord, SceneMetricRecord, SceneSnapshotRecord } from "@/lib/types";
import { getSceneInsight } from "@/lib/vision/insights";

type CameraWithRelations = Prisma.CameraGetPayload<{
  include: {
    metrics: {
      take: 1;
      orderBy: {
        capturedAt: "desc";
      };
    };
    snapshots: {
      take: 1;
      orderBy: {
        capturedAt: "desc";
      };
    };
  };
}>;

function normalizeJson(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function serializeCamera(camera: CameraWithRelations | Prisma.CameraGetPayload<object>): SceneCameraRecord {
  return {
    id: camera.id,
    slug: camera.slug,
    name: camera.name,
    source: camera.source,
    sourceType: camera.sourceType as SceneCameraRecord["sourceType"],
    pageUrl: camera.pageUrl,
    imageUrl: camera.imageUrl,
    latitude: camera.latitude,
    longitude: camera.longitude,
    refreshSeconds: camera.refreshSeconds,
    active: camera.active,
    configJson: (normalizeJson(camera.configJson) as SceneCameraRecord["configJson"]) ?? null,
  };
}

export function serializeSnapshot(snapshot: Prisma.CameraSnapshotGetPayload<object>): SceneSnapshotRecord {
  return {
    id: snapshot.id,
    cameraId: snapshot.cameraId,
    capturedAt: snapshot.capturedAt.toISOString(),
    storagePath: snapshot.storagePath,
    width: snapshot.width,
    height: snapshot.height,
    hash: snapshot.hash,
    expiresAt: snapshot.expiresAt?.toISOString() ?? null,
    metadataJson: normalizeJson(snapshot.metadataJson),
  };
}

export function serializeMetric(metric: Prisma.CameraMetricGetPayload<object>): SceneMetricRecord {
  return {
    id: metric.id,
    cameraId: metric.cameraId,
    capturedAt: metric.capturedAt.toISOString(),
    vehicleCount: metric.vehicleCount,
    carCount: metric.carCount,
    truckCount: metric.truckCount,
    busCount: metric.busCount,
    bikeCount: metric.bikeCount,
    motorcycleCount: metric.motorcycleCount,
    motionIndex: metric.motionIndex,
    visibilityScore: metric.visibilityScore,
    weatherLabel: (metric.weatherLabel as SceneMetricRecord["weatherLabel"]) ?? null,
    anomalyScore: metric.anomalyScore,
    metadataJson: normalizeJson(metric.metadataJson),
  };
}

export async function listSceneCameras() {
  const cameras = await prisma.camera.findMany({
    include: {
      metrics: {
        take: 1,
        orderBy: {
          capturedAt: "desc",
        },
      },
      snapshots: {
        take: 1,
        orderBy: {
          capturedAt: "desc",
        },
      },
    },
    orderBy: [{ active: "desc" }, { sourceType: "asc" }, { name: "asc" }],
  });

  return cameras.map((camera): SceneCameraListItem => ({
    ...serializeCamera(camera),
    latestMetric: camera.metrics[0] ? serializeMetric(camera.metrics[0]) : null,
    latestSnapshot: camera.snapshots[0] ? serializeSnapshot(camera.snapshots[0]) : null,
  }));
}

export async function getCameraMetrics(cameraId: string, rangeHours = 24) {
  const since = new Date(Date.now() - rangeHours * 60 * 60 * 1000);
  const metrics = await prisma.cameraMetric.findMany({
    where: {
      cameraId,
      capturedAt: {
        gte: since,
      },
    },
    orderBy: {
      capturedAt: "desc",
    },
  });

  return metrics.map(serializeMetric);
}

export async function getCameraSnapshots(cameraId: string, limit = 20) {
  const snapshots = await prisma.cameraSnapshot.findMany({
    where: {
      cameraId,
    },
    orderBy: {
      capturedAt: "desc",
    },
    take: limit,
  });

  return snapshots.map(serializeSnapshot);
}

export async function getSceneCameraDetail(cameraId: string, locale: Locale) {
  const [cameras, metrics, snapshots] = await Promise.all([
    listSceneCameras(),
    getCameraMetrics(cameraId),
    getCameraSnapshots(cameraId),
  ]);
  const camera = cameras.find((entry) => entry.id === cameraId) ?? null;

  if (!camera) {
    return null;
  }

  return {
    camera,
    metrics,
    snapshots,
    insight: getSceneInsight(camera, metrics, locale),
  };
}
