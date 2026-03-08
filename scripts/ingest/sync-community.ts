import { fetchAndCacheCommunitySnapshot } from "./lib/community-sources";

async function main() {
  const snapshot = await fetchAndCacheCommunitySnapshot();

  console.log(
    `Refreshed community cache: ${snapshot.manifest.counts.sensors} sensors and ${snapshot.manifest.counts.measurements} measurements.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
