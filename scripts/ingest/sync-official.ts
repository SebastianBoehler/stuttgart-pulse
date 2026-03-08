import { fetchAndCacheOfficialSnapshot } from "./lib/official-sources";

async function main() {
  const snapshot = await fetchAndCacheOfficialSnapshot({
    days: Number(process.env.INGEST_DAYS ?? "30"),
  });

  console.log(
    `Refreshed official cache: ${snapshot.manifest.counts.districts} districts, ${snapshot.manifest.counts.stations} stations, ${snapshot.manifest.counts.measurements} measurements, ${snapshot.manifest.counts.mobilityEvents} mobility events, ${snapshot.manifest.counts.parkingSites} parking sites, ${snapshot.manifest.counts.transitStops} transit stops.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
