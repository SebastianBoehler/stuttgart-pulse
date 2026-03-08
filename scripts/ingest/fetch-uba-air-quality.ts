import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchOfficialSnapshot } from "./lib/official-sources";

async function main() {
  const snapshot = await fetchOfficialSnapshot({
    days: Number(process.env.INGEST_DAYS ?? "30"),
  });
  const outputDir = resolve(process.cwd(), "data", "cache", "official");

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDir, "stations.json"), JSON.stringify(snapshot.stations, null, 2), "utf8"),
    writeFile(resolve(outputDir, "measurements.json"), JSON.stringify(snapshot.measurements, null, 2), "utf8"),
  ]);

  console.log(`Saved ${snapshot.stations.length} official stations and ${snapshot.measurements.length} measurements to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
