import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../lib/prisma";
import { sanitizeDetections } from "../../lib/vision/detect";

const execFileAsync = promisify(execFile);

type WorkerPayload = {
  detections?: Array<Record<string, unknown>>;
  counts?: {
    vehicleCount?: number;
    carCount?: number;
    truckCount?: number;
    busCount?: number;
    bikeCount?: number;
    motorcycleCount?: number;
  };
  motionIndex?: number | null;
  visibilityScore?: number | null;
  weatherLabel?: string | null;
  anomalyScore?: number | null;
  metadata?: Record<string, unknown>;
};

function syntheticFallback(cameraSlug: string, capturedAt: Date): WorkerPayload {
  const hour = capturedAt.getUTCHours();
  const base = cameraSlug.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const vehicleCount = (base % 25) + (hour >= 6 && hour <= 18 ? 12 : 4);

  return {
    counts: {
      vehicleCount,
      carCount: Math.max(0, vehicleCount - 5),
      truckCount: 3,
      busCount: 1,
      bikeCount: hour >= 7 && hour <= 20 ? 2 : 0,
      motorcycleCount: hour >= 8 && hour <= 21 ? 1 : 0,
    },
    motionIndex: Number(((vehicleCount / 40) * 0.8).toFixed(2)),
    visibilityScore: hour >= 19 || hour <= 5 ? 0.42 : 0.81,
    weatherLabel: hour >= 19 || hour <= 5 ? "night" : "clear",
    anomalyScore: Number((((vehicleCount % 8) - 3) / 20).toFixed(2)),
    metadata: {
      fallback: "synthetic",
      note: "Synthetic scene metric used because the Python CV worker was unavailable or the snapshot was not raster-readable.",
    },
    detections: [],
  };
}

async function runPythonWorker({
  imagePath,
  cameraSlug,
  config,
  capturedAt,
}: {
  imagePath: string;
  cameraSlug: string;
  config: Record<string, unknown> | null;
  capturedAt: Date;
}) {
  const pythonBin = process.env.SCENE_PYTHON_BIN ?? "python3";
  const workerPath = resolve(process.cwd(), "python", "scene_worker.py");

  try {
    const { stdout } = await execFileAsync(
      pythonBin,
      [
        workerPath,
        "--image",
        imagePath,
        "--camera-slug",
        cameraSlug,
        "--captured-at",
        capturedAt.toISOString(),
        "--config-json",
        JSON.stringify(config ?? {}),
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    return JSON.parse(stdout) as WorkerPayload;
  } catch {
    return syntheticFallback(cameraSlug, capturedAt);
  }
}

export async function processCameraSnapshot({
  cameraId,
  snapshotId,
}: {
  cameraId?: string;
  snapshotId?: string;
}) {
  const camera = cameraId
    ? await prisma.camera.findUnique({
        where: {
          id: cameraId,
        },
      })
    : null;
  const snapshot = snapshotId
    ? await prisma.cameraSnapshot.findUnique({
        where: {
          id: snapshotId,
        },
      })
    : camera
      ? await prisma.cameraSnapshot.findFirst({
          where: {
            cameraId: camera.id,
          },
          orderBy: {
            capturedAt: "desc",
          },
        })
      : null;

  if (!snapshot) {
    throw new Error("No scene snapshot found to process.");
  }

  const targetCamera =
    camera ??
    (await prisma.camera.findUnique({
      where: {
        id: snapshot.cameraId,
      },
    }));

  if (!targetCamera) {
    throw new Error("No scene camera found for the requested snapshot.");
  }

  const absoluteImagePath = resolve(process.cwd(), "public", snapshot.storagePath.replace(/^\//, ""));
  const payload = await runPythonWorker({
    imagePath: absoluteImagePath,
    cameraSlug: targetCamera.slug,
    config:
      targetCamera.configJson && typeof targetCamera.configJson === "object" && !Array.isArray(targetCamera.configJson)
        ? (targetCamera.configJson as Record<string, unknown>)
        : null,
    capturedAt: snapshot.capturedAt,
  });

  const detections = sanitizeDetections(payload.detections ?? []);

  const createdMetric = await prisma.cameraMetric.create({
    data: {
      cameraId: targetCamera.id,
      capturedAt: snapshot.capturedAt,
      vehicleCount: payload.counts?.vehicleCount ?? detections.length,
      carCount: payload.counts?.carCount ?? detections.filter((entry) => entry.className === "car").length,
      truckCount: payload.counts?.truckCount ?? detections.filter((entry) => entry.className === "truck").length,
      busCount: payload.counts?.busCount ?? detections.filter((entry) => entry.className === "bus").length,
      bikeCount: payload.counts?.bikeCount ?? detections.filter((entry) => entry.className === "bicycle").length,
      motorcycleCount:
        payload.counts?.motorcycleCount ?? detections.filter((entry) => entry.className === "motorcycle").length,
      motionIndex: payload.motionIndex ?? null,
      visibilityScore: payload.visibilityScore ?? null,
      weatherLabel: payload.weatherLabel ?? "unknown",
      anomalyScore: payload.anomalyScore ?? null,
      metadataJson: {
        detections,
        ...payload.metadata,
      },
    },
  });

  return createdMetric;
}

async function main() {
  const cameraSlugArg = process.argv.find((arg) => arg.startsWith("--camera-slug="));
  const snapshotIdArg = process.argv.find((arg) => arg.startsWith("--snapshot-id="));

  if (!cameraSlugArg && !snapshotIdArg) {
    throw new Error("Provide --camera-slug=<slug> or --snapshot-id=<id>.");
  }

  const cameraId =
    cameraSlugArg
      ? (
          await prisma.camera.findUnique({
            where: {
              slug: cameraSlugArg.split("=")[1] ?? "",
            },
          })
        )?.id
      : undefined;
  const metric = await processCameraSnapshot({
    cameraId,
    snapshotId: snapshotIdArg?.split("=")[1],
  });

  console.log(`Processed scene metric ${metric.id}.`);
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
