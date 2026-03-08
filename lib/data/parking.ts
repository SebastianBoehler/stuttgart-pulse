import "server-only";
import { readCachedParkingSites } from "@/lib/data/official-cache";

export async function getParkingSites() {
  const cached = await readCachedParkingSites();
  return cached ?? [];
}
