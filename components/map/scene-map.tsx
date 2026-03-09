"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { useTheme } from "next-themes";
import type { SceneCameraListItem } from "@/lib/types";

type SceneMapProps = {
  cameras: SceneCameraListItem[];
  selectedCameraId: string | null;
  onSelect: (cameraId: string) => void;
};

const center: [number, number] = [48.7758, 9.1829];

function getCameraColor(camera: SceneCameraListItem) {
  if (!camera.active) return "#5f7087";
  if (camera.sourceType === "traffic") return "#cf7a2d";
  if (camera.sourceType === "airport") return "#4d85b8";
  return "#1f6f63";
}

export function SceneMap({ cameras, selectedCameraId, onSelect }: SceneMapProps) {
  const { resolvedTheme } = useTheme();
  const tileUrl =
    resolvedTheme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={center}
      zoom={11.4}
      scrollWheelZoom
      className="readable-attribution h-full min-h-[520px] w-full rounded-[32px]"
      zoomControl={false}
    >
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={tileUrl}
      />

      {cameras.map((camera) => {
        const isSelected = selectedCameraId === camera.id;

        return (
          <CircleMarker
            key={camera.id}
            center={[camera.latitude, camera.longitude]}
            radius={isSelected ? 11 : 8}
            pathOptions={{
              color: "#fffdf7",
              weight: 1.6,
              fillColor: getCameraColor(camera),
              fillOpacity: camera.active ? 0.95 : 0.72,
            }}
            eventHandlers={{
              click: () => onSelect(camera.id),
            }}
          >
            <Popup>
              <div className="space-y-2 text-sm">
                <p className="font-semibold">{camera.name}</p>
                <p>{camera.source}</p>
                <p>Vehicles: {camera.latestMetric?.vehicleCount ?? "—"}</p>
                <p>Visibility: {camera.latestMetric?.visibilityScore !== null && camera.latestMetric?.visibilityScore !== undefined ? `${Math.round(camera.latestMetric.visibilityScore * 100)}%` : "—"}</p>
                <p>Anomaly: {camera.latestMetric?.anomalyScore !== null && camera.latestMetric?.anomalyScore !== undefined ? `${Math.round(camera.latestMetric.anomalyScore * 100)}%` : "—"}</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
