import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type Pollutant = "PM2.5" | "NO2" | "PM10";
export type Locale = "de" | "en";
export type ThemeMode = "system" | "light" | "dark";
export type SceneSourceType = "traffic" | "city" | "airport";
export type SceneWeatherLabel = "clear" | "cloudy" | "foggy" | "rainy" | "night" | "unknown";

export type DistrictProperties = {
  id: string;
  name: string;
  slug: string;
  areaLabel?: string;
  districtNumber?: string;
};

export type DistrictFeature = Feature<Polygon | MultiPolygon, DistrictProperties>;
export type DistrictFeatureCollection = FeatureCollection<Polygon | MultiPolygon, DistrictProperties>;

export type AirQualityStationRecord = {
  id: string;
  name: string;
  districtId: string;
  latitude: number;
  longitude: number;
  source: string;
};

export type AirQualityMeasurementRecord = {
  id: string;
  stationId: string;
  timestamp: string;
  pollutant: Pollutant;
  value: number;
  unit: string;
};

export type CommunityAirSensorRecord = {
  id: string;
  name: string;
  districtId: string;
  latitude: number;
  longitude: number;
  source: string;
};

export type CommunityAirMeasurementRecord = {
  id: string;
  sensorId: string;
  timestamp: string;
  pollutant: "PM2.5" | "PM10";
  value: number;
  unit: string;
};

export type MobilityEventRecord = {
  id: string;
  name: string;
  districtId: string;
  type: string;
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string | null;
  severity: "Low" | "Medium" | "High";
  metadata: Record<string, string>;
};

export type ParkingSiteRecord = {
  id: string;
  name: string;
  districtId: string;
  latitude: number;
  longitude: number;
  source: string;
  type: string;
  address: string | null;
  capacity: number | null;
  availableSpaces: number | null;
  hasRealtimeData: boolean;
  lastUpdated: string | null;
};

export type TransitStopRecord = {
  id: string;
  name: string;
  districtId: string;
  latitude: number;
  longitude: number;
  source: string;
  locationType: string;
  platformCount: number;
  parentStationId: string | null;
};

export type ChartPoint = {
  timestamp: string;
  label: string;
  value: number;
  comparison?: number;
};

export type ExplorerSelection =
  | { type: "district"; id: string }
  | { type: "station"; id: string }
  | { type: "community"; id: string }
  | { type: "mobility"; id: string }
  | { type: "parking"; id: string }
  | { type: "transit"; id: string };

export type ExplorerSnapshot = {
  districts: DistrictFeatureCollection;
  stations: AirQualityStationRecord[];
  measurements: AirQualityMeasurementRecord[];
  communitySensors: CommunityAirSensorRecord[];
  communityMeasurements: CommunityAirMeasurementRecord[];
  mobilityEvents: MobilityEventRecord[];
  parkingSites: ParkingSiteRecord[];
  transitStops: TransitStopRecord[];
  lastUpdated: string | null;
};

export type CompareOption = {
  id: string;
  label: string;
  type: "district" | "station" | "city-average";
};

export type SceneConfig = {
  adapter: "verkehrsinfo-bw" | "stuttgart-city" | "stuttgart-airport";
  tags: string[];
  statusReason?: string;
  attribution?: string;
  placeholderPath?: string;
  countLine?: {
    start: [number, number];
    end: [number, number];
  } | null;
  countZone?: Array<[number, number]> | null;
  roiMasks?: Array<Array<[number, number]>>;
  retentionHours?: number;
  fixtureMode?: "placeholder" | "synthetic";
};

export type SceneCameraRecord = {
  id: string;
  slug: string;
  name: string;
  source: string;
  sourceType: SceneSourceType;
  pageUrl: string;
  imageUrl: string | null;
  latitude: number;
  longitude: number;
  refreshSeconds: number;
  active: boolean;
  configJson: SceneConfig | null;
};

export type SceneSnapshotRecord = {
  id: string;
  cameraId: string;
  capturedAt: string;
  storagePath: string;
  width: number;
  height: number;
  hash: string;
  expiresAt?: string | null;
  metadataJson?: Record<string, unknown> | null;
};

export type SceneMetricRecord = {
  id: string;
  cameraId: string;
  capturedAt: string;
  vehicleCount: number;
  carCount: number;
  truckCount: number;
  busCount: number;
  bikeCount: number;
  motorcycleCount: number;
  motionIndex: number | null;
  visibilityScore: number | null;
  weatherLabel: SceneWeatherLabel | null;
  anomalyScore: number | null;
  metadataJson?: Record<string, unknown> | null;
};

export type SceneCameraListItem = SceneCameraRecord & {
  latestMetric: SceneMetricRecord | null;
  latestSnapshot: SceneSnapshotRecord | null;
};
