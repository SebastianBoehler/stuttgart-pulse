"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Layer } from "leaflet";
import { useTheme } from "next-themes";
import {
  getActiveMobilityCount,
  getLatestForCommunitySensor,
  getLatestForStation,
  getMapDistrictFill,
} from "@/lib/analytics";
import type { DistrictProperties, ExplorerSelection, ExplorerSnapshot } from "@/lib/types";

type ExplorerMapProps = Pick<
  ExplorerSnapshot,
  "districts" | "stations" | "measurements" | "communitySensors" | "communityMeasurements" | "mobilityEvents" | "parkingSites" | "transitStops"
> & {
  layers: {
    districts: boolean;
    officialAir: boolean;
    communityAir: boolean;
    mobility: boolean;
    parking: boolean;
    transit: boolean;
  };
  mode: "move" | "breathe";
  selected: ExplorerSelection | null;
  onSelect: (selection: ExplorerSelection) => void;
};

const center: [number, number] = [48.7758, 9.1829];

function getStationColor(value: number) {
  if (value >= 18) return "#b64d5d";
  if (value >= 14) return "#cf7a2d";
  if (value >= 11) return "#1f6f63";
  return "#8ab4a8";
}

function getMobilityColor(severity: "Low" | "Medium" | "High") {
  if (severity === "High") return "#b64d5d";
  if (severity === "Medium") return "#cf7a2d";
  return "#4d85b8";
}

function getCommunityColor(value: number) {
  if (value >= 22) return "#efb36d";
  if (value >= 14) return "#77a9d8";
  return "#6ec2af";
}

function getParkingColor(availableSpaces: number | null, capacity: number | null, hasRealtimeData: boolean) {
  if (!hasRealtimeData || availableSpaces === null || capacity === null || capacity === 0) {
    return "#5f7087";
  }

  const ratio = availableSpaces / capacity;
  if (ratio <= 0.15) return "#b64d5d";
  if (ratio <= 0.4) return "#cf7a2d";
  return "#1f6f63";
}

export function ExplorerMap({
  districts,
  stations,
  measurements,
  communitySensors,
  communityMeasurements,
  mobilityEvents,
  parkingSites,
  transitStops,
  layers,
  mode,
  selected,
  onSelect,
}: ExplorerMapProps) {
  const { resolvedTheme } = useTheme();
  const tileUrl =
    resolvedTheme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={center}
      zoom={11.8}
      scrollWheelZoom
      className="readable-attribution h-full min-h-[420px] w-full rounded-[28px]"
      zoomControl={false}
    >
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={tileUrl}
      />

      {layers.districts ? (
        <GeoJSON
          key={mode}
          data={districts}
          style={(feature) => {
            const districtId = (feature?.properties as DistrictProperties).id;
            const isSelected = selected?.type === "district" && selected.id === districtId;

            return {
              color: isSelected ? "#0b3f38" : "rgba(23,23,23,0.28)",
              weight: isSelected ? 2.4 : 1.1,
              fillColor: getMapDistrictFill(districtId, mode, measurements, stations, mobilityEvents),
              fillOpacity: isSelected ? 0.82 : 0.62,
            };
          }}
          onEachFeature={(feature, layer: Layer) => {
            layer.on({
              click: () => onSelect({ type: "district", id: (feature.properties as DistrictProperties).id }),
            });
          }}
        />
      ) : null}

      {layers.officialAir
        ? stations.map((station) => {
            const latestPm25 = getLatestForStation(measurements, station.id, "PM2.5")?.value ?? 0;
            const isSelected = selected?.type === "station" && selected.id === station.id;

            return (
              <CircleMarker
                key={station.id}
                center={[station.latitude, station.longitude]}
                radius={isSelected ? 9 : 7}
                pathOptions={{
                  color: "#fffdf7",
                  weight: 1.6,
                  fillColor: getStationColor(latestPm25),
                  fillOpacity: 1,
                }}
                eventHandlers={{
                  click: () => onSelect({ type: "station", id: station.id }),
                }}
              />
            );
          })
        : null}

      {layers.communityAir
        ? communitySensors.map((sensor) => {
            const latestPm25 = getLatestForCommunitySensor(communityMeasurements, sensor.id, "PM2.5")?.value ?? 0;
            const isSelected = selected?.type === "community" && selected.id === sensor.id;

            return (
              <CircleMarker
                key={sensor.id}
                center={[sensor.latitude, sensor.longitude]}
                radius={isSelected ? 7 : 5}
                pathOptions={{
                  color: resolvedTheme === "dark" ? "#172123" : "#fffdf7",
                  weight: 1.6,
                  fillColor: getCommunityColor(latestPm25),
                  fillOpacity: 0.94,
                }}
                eventHandlers={{
                  click: () => onSelect({ type: "community", id: sensor.id }),
                }}
              />
            );
          })
        : null}

      {layers.mobility
        ? mobilityEvents.map((event) => {
            const districtLoad = getActiveMobilityCount(mobilityEvents, event.districtId);
            const isSelected = selected?.type === "mobility" && selected.id === event.id;
            const radius = isSelected ? 11 : 8 + districtLoad * 0.5;

            return (
              <CircleMarker
                key={event.id}
                center={[event.latitude, event.longitude]}
                radius={radius}
                pathOptions={{
                  color: "#fffdf7",
                  weight: 1.6,
                  fillColor: getMobilityColor(event.severity),
                  fillOpacity: 0.96,
                }}
                eventHandlers={{
                  click: () => onSelect({ type: "mobility", id: event.id }),
                }}
              />
            );
          })
        : null}

      {layers.parking
        ? parkingSites.map((site) => {
            const isSelected = selected?.type === "parking" && selected.id === site.id;

            return (
              <CircleMarker
                key={site.id}
                center={[site.latitude, site.longitude]}
                radius={isSelected ? 8 : 6}
                pathOptions={{
                  color: "#fffdf7",
                  weight: 1.4,
                  fillColor: getParkingColor(site.availableSpaces, site.capacity, site.hasRealtimeData),
                  fillOpacity: 0.96,
                }}
                eventHandlers={{
                  click: () => onSelect({ type: "parking", id: site.id }),
                }}
              />
            );
          })
        : null}

      {layers.transit
        ? transitStops.map((stop) => {
            const isSelected = selected?.type === "transit" && selected.id === stop.id;

            return (
              <CircleMarker
                key={stop.id}
                center={[stop.latitude, stop.longitude]}
                radius={isSelected ? 6 : 4}
                pathOptions={{
                  color: resolvedTheme === "dark" ? "#d8e4f0" : "#163c66",
                  weight: isSelected ? 2 : 1.2,
                  fillColor: resolvedTheme === "dark" ? "#6b96c7" : "#8fb7e0",
                  fillOpacity: 0.85,
                }}
                eventHandlers={{
                  click: () => onSelect({ type: "transit", id: stop.id }),
                }}
              />
            );
          })
        : null}
    </MapContainer>
  );
}
