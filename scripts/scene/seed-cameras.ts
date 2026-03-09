import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../lib/prisma";
import { getAllCameraDefinitions } from "../../lib/cameras";

function getDemoMetric(sourceType: string, active: boolean) {
  if (sourceType === "traffic") {
    return { vehicleCount: 41, carCount: 30, truckCount: 6, busCount: 1, bikeCount: 2, motorcycleCount: 2, motionIndex: 0.62, visibilityScore: 0.74, weatherLabel: "cloudy", anomalyScore: 0.21 };
  }

  if (sourceType === "airport") {
    return { vehicleCount: 8, carCount: 5, truckCount: 2, busCount: 1, bikeCount: 0, motorcycleCount: 0, motionIndex: 0.18, visibilityScore: 0.82, weatherLabel: "clear", anomalyScore: -0.06 };
  }

  return {
    vehicleCount: active ? 12 : 0,
    carCount: active ? 8 : 0,
    truckCount: 0,
    busCount: 0,
    bikeCount: active ? 2 : 0,
    motorcycleCount: active ? 2 : 0,
    motionIndex: active ? 0.34 : 0.08,
    visibilityScore: 0.86,
    weatherLabel: "clear",
    anomalyScore: active ? 0.04 : null,
  };
}

async function ensurePlaceholderPath(publicPath: string | undefined) {
  if (!publicPath) {
    return null;
  }

  const absolutePath = resolve(process.cwd(), "public", publicPath.replace(/^\//, ""));
  await mkdir(dirname(absolutePath), { recursive: true });
  return publicPath;
}

export async function syncSeedCameras() {
  const cameras = await getAllCameraDefinitions();

  for (const definition of cameras) {
    const camera = await prisma.camera.upsert({
      where: {
        slug: definition.slug,
      },
      update: {
        name: definition.name,
        source: definition.source,
        sourceType: definition.sourceType,
        pageUrl: definition.pageUrl,
        imageUrl: definition.imageUrl,
        latitude: definition.latitude,
        longitude: definition.longitude,
        refreshSeconds: definition.refreshSeconds,
        active: definition.active,
        configJson: definition.configJson ?? undefined,
      },
      create: {
        slug: definition.slug,
        name: definition.name,
        source: definition.source,
        sourceType: definition.sourceType,
        pageUrl: definition.pageUrl,
        imageUrl: definition.imageUrl,
        latitude: definition.latitude,
        longitude: definition.longitude,
        refreshSeconds: definition.refreshSeconds,
        active: definition.active,
        configJson: definition.configJson ?? undefined,
      },
    });

    const existingMetricCount = await prisma.cameraMetric.count({
      where: {
        cameraId: camera.id,
      },
    });

    if (existingMetricCount === 0) {
      await prisma.cameraMetric.create({
        data: {
          cameraId: camera.id,
          capturedAt: new Date(),
          ...getDemoMetric(camera.sourceType, camera.active),
          metadataJson: {
            seeded: true,
            note: "Demo metric inserted during scene seed to make the local MVP readable before the first live processing run.",
          },
        },
      });
    }

    const existingSnapshotCount = await prisma.cameraSnapshot.count({
      where: {
        cameraId: camera.id,
      },
    });

    const placeholderPath = await ensurePlaceholderPath(camera.configJson && typeof camera.configJson === "object" && !Array.isArray(camera.configJson)
      ? (camera.configJson as { placeholderPath?: string }).placeholderPath
      : undefined);

    if (existingSnapshotCount === 0 && placeholderPath) {
      await prisma.cameraSnapshot.create({
        data: {
          cameraId: camera.id,
          capturedAt: new Date(),
          storagePath: placeholderPath,
          width: 1280,
          height: 720,
          hash: `seed-${camera.slug}`,
          expiresAt: null,
          metadataJson: {
            seeded: true,
            placeholder: true,
          },
        },
      });
    }
  }
}

async function main() {
  await syncSeedCameras();
  console.log("Scene cameras synced into Prisma.");
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
