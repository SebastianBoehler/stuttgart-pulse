import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import AdmZip from "adm-zip";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import proj4 from "proj4";
import initSqlJs from "sql.js";
import wkx from "wkx";
import type { Geometry } from "geojson";
import type {
  AirQualityMeasurementRecord,
  AirQualityStationRecord,
  DistrictFeature,
  DistrictFeatureCollection,
  MobilityEventRecord,
  ParkingSiteRecord,
  TransitStopRecord,
} from "../../../lib/types";

const require = createRequire(import.meta.url);
const DISTRICTS_URL = "https://www.stuttgart.de/medien/ibs/OpenData-KLGL-Generalsisiert.zip";
const STUTTGART_WFS_BASE = "https://geoserver.stuttgart.de/gdc/Verkehr_Mobilitaet/ows";
const UBA_BASE = "https://www.umweltbundesamt.de/api/air_data/v3";
const PARKING_BASE = "https://api.mobidata-bw.de/park-api/api/public/v3";
const GTFS_BASE = "https://api.mobidata-bw.de/gtfs";
const cacheDir = resolve(process.cwd(), "data", "cache", "official");
const STUTTGART_CENTER = {
  latitude: 48.7758,
  longitude: 9.1829,
  radiusMeters: 15000,
};

proj4.defs(
  "EPSG:25832",
  "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs +type=crs",
);

type SyncOptions = {
  days?: number;
};

type SourceManifest = {
  fetchedAt: string;
  dateRange: {
    from: string;
    to: string;
  };
  counts: {
    districts: number;
    stations: number;
    measurements: number;
    mobilityEvents: number;
    parkingSites: number;
    transitStops: number;
  };
  sources: Record<string, string>;
};

type OfficialSnapshot = {
  districts: DistrictFeatureCollection;
  stations: AirQualityStationRecord[];
  measurements: AirQualityMeasurementRecord[];
  mobilityEvents: MobilityEventRecord[];
  parkingSites: ParkingSiteRecord[];
  transitStops: TransitStopRecord[];
  manifest: SourceManifest;
};

function slugifyGerman(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function transformCoordinates(value: unknown): unknown {
  if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number") {
    return proj4("EPSG:25832", "WGS84", [value[0], value[1]]);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => transformCoordinates(entry));
  }

  return value;
}

function stripGeoPackageHeader(blob: Uint8Array) {
  const flags = blob[3] ?? 0;
  const envelopeIndicator = (flags >> 1) & 0b111;
  const envelopeSize =
    envelopeIndicator === 0 ? 0 : envelopeIndicator === 1 ? 32 : envelopeIndicator === 2 || envelopeIndicator === 3 ? 48 : 64;
  const headerSize = 8 + envelopeSize;

  return blob.slice(headerSize);
}

function toFeatureGeometry(blobHex: string) {
  const raw = Buffer.from(blobHex, "hex");
  const wkb = Buffer.from(stripGeoPackageHeader(raw));
  const geometry = wkx.Geometry.parse(wkb).toGeoJSON() as {
    type: Geometry["type"];
    coordinates: unknown;
  };

  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    throw new Error(`Unexpected district geometry type: ${geometry.type}`);
  }

  return {
    ...geometry,
    coordinates: transformCoordinates(geometry.coordinates),
  } as DistrictFeature["geometry"];
}

function normalizeDistrictName(name: string) {
  return name.startsWith("Stuttgart-") ? name : name;
}

async function fetchDistricts() {
  const response = await fetch(DISTRICTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Stuttgart districts: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = new AdmZip(buffer);
  const gpkgEntry = zip
    .getEntries()
    .find((entry) => entry.entryName.toLowerCase().endsWith(".gpkg"));

  if (!gpkgEntry) {
    throw new Error("Could not find a GeoPackage inside the Stuttgart district archive.");
  }

  const gpkgBytes = gpkgEntry.getData();
  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const db = new SQL.Database(gpkgBytes);
  const result = db.exec(`
    SELECT
      STADTBEZIRKNAME,
      STADTBEZIRKNR,
      hex(SHAPE) AS shape_hex
    FROM KLGL_BRUTTO_STADTBEZIRK
    ORDER BY CAST(STADTBEZIRKNR AS INTEGER)
  `);

  const values = result[0]?.values ?? [];
  const features: DistrictFeature[] = values.map((row) => {
    const name = normalizeDistrictName(String(row[0] ?? ""));
    const districtNumber = String(row[1] ?? "");
    const geometry = toFeatureGeometry(String(row[2] ?? ""));

    return {
      type: "Feature",
      properties: {
        id: slugifyGerman(name),
        name,
        slug: slugifyGerman(name),
        districtNumber,
      },
      geometry,
    };
  });

  return {
    type: "FeatureCollection",
    features,
  } satisfies DistrictFeatureCollection;
}

function getDistrictIdIfInside(districts: DistrictFeatureCollection, longitude: number, latitude: number) {
  const location = point([longitude, latitude]);
  const match = districts.features.find((feature) => booleanPointInPolygon(location, feature));
  return match?.properties.id ?? null;
}

function findDistrictId(districts: DistrictFeatureCollection, longitude: number, latitude: number) {
  return getDistrictIdIfInside(districts, longitude, latitude) ?? districts.features[0]?.properties.id ?? "stuttgart";
}

function toIsoTimestamp(value: string) {
  return new Date(value.replace(" ", "T") + "Z").toISOString();
}

async function fetchUbaComponentUnits() {
  const response = await fetch(`${UBA_BASE}/components/json?lang=de&index=id`);
  if (!response.ok) {
    throw new Error(`Failed to fetch UBA component metadata: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const units = new Map<string, string>();

  for (const [key, value] of Object.entries(payload)) {
    if (!/^\d+$/.test(key) || !Array.isArray(value)) {
      continue;
    }

    units.set(key, String(value[3] ?? "µg/m³"));
  }

  return units;
}

async function fetchUbaStations(dateFrom: string, dateTo: string, districts: DistrictFeatureCollection) {
  const response = await fetch(
    `${UBA_BASE}/stations/json?lang=de&use=airquality&date_from=${dateFrom}&date_to=${dateTo}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch UBA stations: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: Record<string, string[]>;
  };

  return Object.entries(payload.data ?? {})
    .filter(([, value]) => value[3] === "Stuttgart" || String(value[2] ?? "").startsWith("Stuttgart"))
    .map(
      ([stationId, value]): AirQualityStationRecord => ({
        id: stationId,
        name: String(value[2] ?? stationId),
        districtId: findDistrictId(districts, Number(value[7]), Number(value[8])),
        latitude: Number(value[8]),
        longitude: Number(value[7]),
        source: "Umweltbundesamt API v3",
      }),
    );
}

async function fetchUbaMeasurements(dateFrom: string, dateTo: string, stations: AirQualityStationRecord[]) {
  const componentUnits = await fetchUbaComponentUnits();
  const targets = [
    { componentId: "5", pollutant: "NO2" as const },
    { componentId: "9", pollutant: "PM2.5" as const },
  ];

  const measurementGroups = await Promise.all(
    stations.flatMap((station) =>
      targets.map(async (target) => {
        const url =
          `${UBA_BASE}/measures/json?date_from=${dateFrom}&time_from=00:00:00&date_to=${dateTo}&time_to=23:00:00` +
          `&station=${station.id}&component=${target.componentId}&scope=2&lang=de`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch UBA measures for station ${station.id}: ${response.status} ${response.statusText}`);
        }

        const payload = (await response.json()) as {
          data?: Record<string, Record<string, [number, number, number, string, string]>>;
        };
        const stationRows = payload.data?.[station.id] ?? {};

        return Object.entries(stationRows)
          .map(([timestamp, value]): AirQualityMeasurementRecord | null => {
            const numericValue = Number(value[2]);
            if (!Number.isFinite(numericValue)) {
              return null;
            }

            return {
              id: `${station.id}-${target.componentId}-${timestamp}`,
              stationId: station.id,
              timestamp: toIsoTimestamp(timestamp),
              pollutant: target.pollutant,
              value: numericValue,
              unit: componentUnits.get(target.componentId) ?? "µg/m³",
            };
          })
          .filter((item): item is AirQualityMeasurementRecord => item !== null);
      }),
    ),
  );

  return measurementGroups.flat().sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

function parseGermanDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const exactMatch = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (exactMatch) {
    const [, day, month, year] = exactMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12)).toISOString();
  }

  const monthNames: Record<string, number> = {
    januar: 0,
    februar: 1,
    maerz: 2,
    märz: 2,
    april: 3,
    mai: 4,
    juni: 5,
    juli: 6,
    august: 7,
    september: 8,
    oktober: 9,
    november: 10,
    dezember: 11,
  };
  const fuzzyMatch = value.trim().toLowerCase().match(/(anfang|mitte|ende)?\s*([a-zäöü]+)\s+(\d{4})/);

  if (fuzzyMatch) {
    const [, qualifier, monthName, year] = fuzzyMatch;
    const month = monthNames[monthName];
    if (month !== undefined) {
      const day = qualifier === "mitte" ? 15 : qualifier === "ende" ? 25 : 1;
      return new Date(Date.UTC(Number(year), month, day, 12)).toISOString();
    }
  }

  return null;
}

function classifySeverity(impact: string) {
  const value = impact.toLowerCase();
  if (value.includes("vollsperr")) return "High" as const;
  if (value.includes("sperr") || value.includes("eineng") || value.includes("verschwenk")) return "Medium" as const;
  return "Low" as const;
}

async function fetchRoadworksLayer(typeName: string) {
  const url =
    `${STUTTGART_WFS_BASE}?service=WFS&version=1.0.0&request=GetFeature` +
    `&typeName=${encodeURIComponent(typeName)}&outputFormat=application/json&srsName=EPSG:4326`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Stuttgart roadworks layer ${typeName}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as {
    features?: Array<{
      id?: string;
      geometry?: Geometry;
      properties?: Record<string, string | null>;
    }>;
  };
}

function getPointFromGeometry(geometry: Geometry | undefined) {
  if (!geometry) {
    return null;
  }

  if (geometry.type === "Point") {
    return {
      longitude: geometry.coordinates[0],
      latitude: geometry.coordinates[1],
    };
  }

  return null;
}

async function fetchMobilityEvents(districts: DistrictFeatureCollection) {
  const [active, planned] = await Promise.all([
    fetchRoadworksLayer("Verkehr_Mobilitaet:A66_BAUM_BAUSTELLEN_DATE_WEB_im_Bau_EPSG25832"),
    fetchRoadworksLayer("Verkehr_Mobilitaet:A66_BAUM_BAUSTELLEN_DATE_WEB_geplant_EPSG25832"),
  ]);

  const features = [...(active.features ?? []), ...(planned.features ?? [])];

  return features
    .map((feature, index): MobilityEventRecord | null => {
      const pointGeometry = getPointFromGeometry(feature.geometry);
      if (!pointGeometry) {
        return null;
      }

      const properties = feature.properties ?? {};
      const road = String(properties.STRASSENNAME ?? "").trim();
      const workType = String(properties.ART_ARBEIT ?? "").trim();
      const impact = String(properties.VERKEHRSAUSWIRKUNG ?? "").trim();
      const status = String(properties.STATUS ?? "").trim();
      const details = String(properties.DETAILS_STANDORT ?? "").trim();
      const name = [road, workType].filter(Boolean).join(" • ") || `Baustelle ${index + 1}`;

      return {
        id: feature.id ?? `${slugifyGerman(name)}-${index + 1}`,
        name,
        districtId: findDistrictId(districts, pointGeometry.longitude, pointGeometry.latitude),
        type: workType || "Roadworks",
        latitude: pointGeometry.latitude,
        longitude: pointGeometry.longitude,
        startTime: parseGermanDate(String(properties.ANFANG ?? "")) ?? new Date().toISOString(),
        endTime: parseGermanDate(String(properties.ENDE ?? "")),
        severity: classifySeverity(impact),
        metadata: {
          impact,
          status,
          details,
          source: "Stuttgart GeoServer WFS",
        },
      };
    })
    .filter((item): item is MobilityEventRecord => item !== null);
}

type ParkApiParkingSite = {
  id?: number;
  name?: string;
  address?: string;
  type?: string;
  lat?: string;
  lon?: string;
  capacity?: number;
  has_realtime_data?: boolean;
  realtime_free_capacity?: number;
  realtime_data_updated_at?: string;
  static_data_updated_at?: string;
};

async function fetchParkingSites(districts: DistrictFeatureCollection) {
  const url = new URL(`${PARKING_BASE}/parking-sites`);
  url.searchParams.set("lat", String(STUTTGART_CENTER.latitude));
  url.searchParams.set("lon", String(STUTTGART_CENTER.longitude));
  url.searchParams.set("radius", String(STUTTGART_CENTER.radiusMeters));
  url.searchParams.set("purpose", "CAR");
  url.searchParams.set("not_type", "ON_STREET");
  url.searchParams.set("limit", "1000");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "stuttgart-pulse/0.1.0",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch parking sites: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    items?: ParkApiParkingSite[];
  };

  return (payload.items ?? [])
    .map((site): ParkingSiteRecord | null => {
      const latitude = Number(site.lat);
      const longitude = Number(site.lon);
      if (!site.id || !site.name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      const districtId = getDistrictIdIfInside(districts, longitude, latitude);
      if (!districtId) {
        return null;
      }

      return {
        id: String(site.id),
        name: site.name.trim(),
        districtId,
        latitude,
        longitude,
        source: "MobiData BW ParkAPI",
        type: site.type ?? "Parking",
        address: site.address?.trim() || null,
        capacity: typeof site.capacity === "number" ? site.capacity : null,
        availableSpaces: typeof site.realtime_free_capacity === "number" ? site.realtime_free_capacity : null,
        hasRealtimeData: Boolean(site.has_realtime_data),
        lastUpdated: site.realtime_data_updated_at ?? site.static_data_updated_at ?? null,
      };
    })
    .filter((item): item is ParkingSiteRecord => item !== null)
    .sort((left, right) => {
      if (left.availableSpaces !== null && right.availableSpaces !== null) {
        return right.availableSpaces - left.availableSpaces;
      }
      return left.name.localeCompare(right.name);
    });
}

type GtfsStopRow = {
  stop_id?: string;
  stop_name?: string;
  stop_loc?: { type?: string; coordinates?: [number, number] };
  parent_station?: string | null;
  location_type?: string | null;
  platform_code?: string | null;
};

async function fetchTransitStops(districts: DistrictFeatureCollection) {
  const url = new URL(`${GTFS_BASE}/stops`);
  url.searchParams.set("stop_id", "like.de:08111:*");
  url.searchParams.set("limit", "5000");
  url.searchParams.set("select", "stop_id,stop_name,stop_loc,parent_station,location_type,platform_code");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "stuttgart-pulse/0.1.0",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch GTFS stops: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as GtfsStopRow[];
  const collapsed = new Map<string, TransitStopRecord>();

  for (const row of rows) {
    const coordinates = row.stop_loc?.coordinates;
    if (!row.stop_id || !row.stop_name || !coordinates || coordinates.length < 2) {
      continue;
    }

    const [longitude, latitude] = coordinates;
    const districtId = getDistrictIdIfInside(districts, longitude, latitude);
    if (!districtId) {
      continue;
    }

    const normalizedName = row.stop_name.replace(/\s+Gleis\s+\S+$/u, "").trim();
    const groupId = row.parent_station ?? `${normalizedName}:${longitude.toFixed(5)}:${latitude.toFixed(5)}`;
    const existing = collapsed.get(groupId);

    if (existing) {
      existing.platformCount += 1;
      continue;
    }

    collapsed.set(groupId, {
      id: groupId,
      name: normalizedName,
      districtId,
      latitude,
      longitude,
      source: "MobiData BW GTFS",
      locationType: row.location_type ?? "stop",
      platformCount: 1,
      parentStationId: row.parent_station ?? null,
    });
  }

  return [...collapsed.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function writeOfficialCache(snapshot: OfficialSnapshot) {
  await mkdir(cacheDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(cacheDir, "districts.json"), JSON.stringify(snapshot.districts, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "stations.json"), JSON.stringify(snapshot.stations, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "measurements.json"), JSON.stringify(snapshot.measurements, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "mobility-events.json"), JSON.stringify(snapshot.mobilityEvents, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "parking-sites.json"), JSON.stringify(snapshot.parkingSites, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "transit-stops.json"), JSON.stringify(snapshot.transitStops, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "manifest.json"), JSON.stringify(snapshot.manifest, null, 2), "utf8"),
  ]);
}

export async function fetchOfficialSnapshot(options: SyncOptions = {}) {
  const days = options.days ?? 30;
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - days);
  const dateFrom = startDate.toISOString().slice(0, 10);
  const dateTo = endDate.toISOString().slice(0, 10);

  const districts = await fetchDistricts();
  const stations = await fetchUbaStations(dateFrom, dateTo, districts);
  const [measurements, mobilityEvents, parkingSites, transitStops] = await Promise.all([
    fetchUbaMeasurements(dateFrom, dateTo, stations),
    fetchMobilityEvents(districts),
    fetchParkingSites(districts),
    fetchTransitStops(districts),
  ]);

  const manifest: SourceManifest = {
    fetchedAt: new Date().toISOString(),
    dateRange: {
      from: dateFrom,
      to: dateTo,
    },
    counts: {
      districts: districts.features.length,
      stations: stations.length,
      measurements: measurements.length,
      mobilityEvents: mobilityEvents.length,
      parkingSites: parkingSites.length,
      transitStops: transitStops.length,
    },
    sources: {
      districts: DISTRICTS_URL,
      airQualityStations: `${UBA_BASE}/stations/json`,
      airQualityMeasures: `${UBA_BASE}/measures/json`,
      mobility: STUTTGART_WFS_BASE,
      parking: `${PARKING_BASE}/parking-sites`,
      transitStops: `${GTFS_BASE}/stops`,
    },
  };

  return {
    districts,
    stations,
    measurements,
    mobilityEvents,
    parkingSites,
    transitStops,
    manifest,
  } satisfies OfficialSnapshot;
}

export async function fetchAndCacheOfficialSnapshot(options: SyncOptions = {}) {
  const snapshot = await fetchOfficialSnapshot(options);
  await writeOfficialCache(snapshot);
  return snapshot;
}
