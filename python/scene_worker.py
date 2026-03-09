#!/usr/bin/env python3
import argparse
import json
import math
import os
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process a scene snapshot with optional OpenCV/YOLO analytics.")
    parser.add_argument("--image", required=True)
    parser.add_argument("--camera-slug", required=True)
    parser.add_argument("--captured-at", required=True)
    parser.add_argument("--config-json", default="{}")
    return parser.parse_args()


def synthetic_result(camera_slug: str, reason: str) -> dict[str, Any]:
    seed = sum(ord(character) for character in camera_slug)
    vehicle_count = (seed % 18) + 7
    visibility = ((seed % 35) + 55) / 100
    motion = min(0.95, vehicle_count / 26)
    return {
        "detections": [],
        "counts": {
            "vehicleCount": vehicle_count,
            "carCount": max(vehicle_count - 4, 0),
            "truckCount": 2,
            "busCount": 1,
            "bikeCount": 1,
            "motorcycleCount": 0,
        },
        "motionIndex": round(motion, 2),
        "visibilityScore": round(visibility, 2),
        "weatherLabel": "unknown",
        "anomalyScore": round(((seed % 7) - 3) / 15, 2),
        "metadata": {
            "fallback": "synthetic",
            "reason": reason,
        },
    }


def visibility_label(brightness: float, contrast: float) -> str:
    if brightness < 40:
        return "night"
    if contrast < 25:
        return "foggy"
    if brightness < 85:
        return "cloudy"
    return "clear"


def run_worker(image_path: str, camera_slug: str, config: dict[str, Any]) -> dict[str, Any]:
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        return synthetic_result(camera_slug, "OpenCV dependencies not installed.")

    if not os.path.exists(image_path):
        return synthetic_result(camera_slug, "Snapshot path does not exist.")

    frame = cv2.imread(image_path)
    if frame is None:
        return synthetic_result(camera_slug, "Snapshot could not be raster decoded.")

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    edges = cv2.Canny(gray, 60, 160)
    visibility_score = max(0.0, min(1.0, (contrast / 64.0 + float(np.mean(edges)) / 128.0) / 2.0))

    detections: list[dict[str, Any]] = []
    counts = {
        "vehicleCount": 0,
        "carCount": 0,
        "truckCount": 0,
        "busCount": 0,
        "bikeCount": 0,
        "motorcycleCount": 0,
    }
    metadata: dict[str, Any] = {
        "worker": "python",
        "personTrackingExcluded": True,
    }

    try:
        from ultralytics import YOLO  # type: ignore

        model = YOLO("yolov8n.pt")
        result = model.track(
            source=image_path,
            persist=False,
            verbose=False,
            classes=[1, 2, 3, 5, 7],
            tracker="botsort.yaml",
        )[0]

        names = result.names
        boxes = result.boxes
        if boxes is not None:
          xyxy = boxes.xyxy.cpu().numpy().tolist()
          confidences = boxes.conf.cpu().numpy().tolist() if boxes.conf is not None else []
          classes = boxes.cls.cpu().numpy().tolist() if boxes.cls is not None else []
          track_ids = boxes.id.cpu().numpy().tolist() if getattr(boxes, "id", None) is not None else []

          for index, bbox in enumerate(xyxy):
              class_name = str(names.get(int(classes[index]), ""))
              if class_name not in ["car", "truck", "bus", "motorcycle", "bicycle"]:
                  continue
              detection = {
                  "className": class_name,
                  "confidence": float(confidences[index]) if index < len(confidences) else 0.0,
                  "bbox": [float(value) for value in bbox],
                  "trackId": int(track_ids[index]) if index < len(track_ids) else None,
              }
              detections.append(detection)

              counts["vehicleCount"] += 1
              if class_name == "car":
                  counts["carCount"] += 1
              elif class_name == "truck":
                  counts["truckCount"] += 1
              elif class_name == "bus":
                  counts["busCount"] += 1
              elif class_name == "bicycle":
                  counts["bikeCount"] += 1
              elif class_name == "motorcycle":
                  counts["motorcycleCount"] += 1

          metadata["trackingMode"] = "botsort"
          metadata["trackingIdsPresent"] = any(detection["trackId"] is not None for detection in detections)
    except Exception as error:
        metadata["fallback"] = "heuristic"
        metadata["fallbackReason"] = f"Ultralytics worker unavailable: {error}"

    motion_index = round(min(1.0, counts["vehicleCount"] / 20.0 + float(np.mean(edges)) / 255.0 * 0.35), 2)

    if counts["vehicleCount"] == 0:
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        proxy_count = min(14, sum(1 for contour in contours if cv2.contourArea(contour) > 120))
        counts["vehicleCount"] = proxy_count
        counts["carCount"] = proxy_count
        metadata["fallbackCountProxy"] = proxy_count

    if config.get("countZone"):
        metadata["countZoneConfigured"] = True
    if config.get("countLine"):
        metadata["countLineConfigured"] = True

    return {
        "detections": detections,
        "counts": counts,
        "motionIndex": motion_index,
        "visibilityScore": round(visibility_score, 2),
        "weatherLabel": visibility_label(brightness, contrast),
        "anomalyScore": round((counts["vehicleCount"] - 12) / 24, 2),
        "metadata": metadata,
    }


def main() -> None:
    args = parse_args()
    config = json.loads(args.config_json)
    result = run_worker(args.image, args.camera_slug, config)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
