import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

export function toPublicSnapshotPath(cameraSlug: string, fileName: string) {
  return `/scene/generated/${cameraSlug}/${fileName}`;
}

export function toAbsoluteSnapshotPath(publicPath: string) {
  return join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

export async function ensureSnapshotDirectory(cameraSlug: string) {
  const dirPath = join(process.cwd(), "public", "scene", "generated", cameraSlug);
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

export async function removeSnapshotIfExists(publicPath: string) {
  try {
    await unlink(toAbsoluteSnapshotPath(publicPath));
  } catch {
    // Ignore missing files during retention cleanup.
  }
}
