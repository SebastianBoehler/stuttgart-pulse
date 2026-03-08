import "server-only";
import { readCachedTransitStops } from "@/lib/data/official-cache";

export async function getTransitStops() {
  const cached = await readCachedTransitStops();
  return cached ?? [];
}
