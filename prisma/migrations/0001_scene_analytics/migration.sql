-- CreateTable
CREATE TABLE "Camera" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "refreshSeconds" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CameraSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cameraId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "storagePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "metadataJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CameraSnapshot_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CameraMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cameraId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "vehicleCount" INTEGER NOT NULL DEFAULT 0,
    "carCount" INTEGER NOT NULL DEFAULT 0,
    "truckCount" INTEGER NOT NULL DEFAULT 0,
    "busCount" INTEGER NOT NULL DEFAULT 0,
    "bikeCount" INTEGER NOT NULL DEFAULT 0,
    "motorcycleCount" INTEGER NOT NULL DEFAULT 0,
    "motionIndex" REAL,
    "visibilityScore" REAL,
    "weatherLabel" TEXT,
    "anomalyScore" REAL,
    "metadataJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CameraMetric_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Camera_slug_key" ON "Camera"("slug");

-- CreateIndex
CREATE INDEX "CameraSnapshot_cameraId_capturedAt_idx" ON "CameraSnapshot"("cameraId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "CameraMetric_cameraId_capturedAt_idx" ON "CameraMetric"("cameraId", "capturedAt" DESC);

