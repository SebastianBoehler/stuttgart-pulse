import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getCameraAdapter, getAllCameraDefinitions } from "../../lib/cameras";
import { prisma } from "../../lib/prisma";
import { ensureSnapshotDirectory, removeSnapshotIfExists, toPublicSnapshotPath } from "../../lib/vision/snapshots";
import { processCameraSnapshot } from "./process-camera";
import { syncSeedCameras } from "./seed-cameras";

function getContentExtension(contentType: string | null) {
  if (!contentType) {
    return ".jpg";
  }

  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  return ".jpg";
}

async function pruneExpiredSnapshots() {
  const expiredSnapshots = await prisma.cameraSnapshot.findMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  for (const snapshot of expiredSnapshots) {
    if (snapshot.storagePath.startsWith("/scene/generated/")) {
      await removeSnapshotIfExists(snapshot.storagePath);
    }
  }

  if (expiredSnapshots.length > 0) {
    await prisma.cameraSnapshot.deleteMany({
      where: {
        id: {
          in: expiredSnapshots.map((snapshot) => snapshot.id),
        },
      },
    });
  }
}

async function saveSnapshotForCamera(cameraId: string, cameraSlug: string, result: {
  capturedAt: string;
  contentType?: string | null;
  imageBuffer?: Buffer;
  hash?: string;
  fallbackPath?: string;
  degradedReason?: string;
}) {
  const capturedAt = new Date(result.capturedAt);
  const ttlHours = Number(process.env.SCENE_SNAPSHOT_TTL_HOURS ?? "24");

  let storagePath = result.fallbackPath ?? "";
  const width = 1280;
  const height = 720;
  let hash = result.hash ?? createHash("sha1").update(`${cameraSlug}-${capturedAt.toISOString()}`).digest("hex");

  if (result.imageBuffer) {
    await ensureSnapshotDirectory(cameraSlug);
    const extension = getContentExtension(result.contentType ?? null);
    const fileName = `${capturedAt.toISOString().replace(/[:.]/g, "-")}${extension}`;
    storagePath = toPublicSnapshotPath(cameraSlug, fileName);
    await writeFile(fileURLToPath(new URL(`file://${process.cwd()}/public${storagePath}`)), result.imageBuffer);
    hash = result.hash ?? createHash("sha1").update(result.imageBuffer).digest("hex");
  }

  return prisma.cameraSnapshot.create({
    data: {
      cameraId,
      capturedAt,
      storagePath,
      width,
      height,
      hash,
      expiresAt: storagePath.startsWith("/scene/generated/")
        ? new Date(capturedAt.getTime() + ttlHours * 60 * 60 * 1000)
        : null,
      metadataJson: result.degradedReason
        ? {
            degradedReason: result.degradedReason,
          }
        : undefined,
    },
  });
}

export async function fetchSceneSnapshots() {
  await syncSeedCameras();
  await pruneExpiredSnapshots();

  const definitions = await getAllCameraDefinitions();
  const summary: Array<{ slug: string; status: "fetched" | "placeholder" | "skipped" }> = [];

  for (const definition of definitions) {
    const camera = await prisma.camera.findUnique({
      where: {
        slug: definition.slug,
      },
    });

    if (!camera) {
      continue;
    }

    const adapter = getCameraAdapter(definition.configJson?.adapter ?? "");
    if (!adapter) {
      summary.push({ slug: definition.slug, status: "skipped" });
      continue;
    }

    if (!definition.active) {
      summary.push({ slug: definition.slug, status: "skipped" });
      continue;
    }

    const result = await adapter.fetchLatestSnapshot(definition);
    const placeholderPath = definition.configJson?.placeholderPath ?? null;

    const snapshot = await saveSnapshotForCamera(camera.id, camera.slug, result.ok
      ? {
          capturedAt: result.capturedAt,
          contentType: result.contentType,
          imageBuffer: result.imageBuffer,
          hash: result.hash,
        }
      : {
          capturedAt: result.capturedAt,
          fallbackPath: placeholderPath ?? "",
          degradedReason: result.degradedReason,
        });

    await processCameraSnapshot({
      snapshotId: snapshot.id,
    });

    summary.push({
      slug: definition.slug,
      status: result.ok ? "fetched" : "placeholder",
    });
  }

  return summary;
}

async function main() {
  const summary = await fetchSceneSnapshots();
  console.log(JSON.stringify(summary, null, 2));
}

const entryPath = process.argv[1] ? fileURLToPath(new URL(`file://${process.argv[1]}`)) : null;
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
