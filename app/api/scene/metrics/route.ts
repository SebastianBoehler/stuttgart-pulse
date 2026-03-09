import { NextRequest, NextResponse } from "next/server";
import { getSceneCameraDetail } from "@/lib/scene";
import { getRollingAverage } from "@/lib/vision/count";
import type { Locale } from "@/lib/types";

function parseRange(value: string | null) {
  if (!value) {
    return 24;
  }

  if (value.endsWith("h")) {
    return Number(value.replace("h", ""));
  }

  if (value.endsWith("d")) {
    return Number(value.replace("d", "")) * 24;
  }

  return 24;
}

export async function GET(request: NextRequest) {
  const cameraId = request.nextUrl.searchParams.get("cameraId");
  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const locale = (request.nextUrl.searchParams.get("locale") ?? "en") as Locale;

  if (!cameraId) {
    return NextResponse.json({ error: "cameraId is required." }, { status: 400 });
  }

  try {
    const detail = await getSceneCameraDetail(cameraId, locale);
    if (!detail) {
      return NextResponse.json({ error: "Camera not found." }, { status: 404 });
    }

    const metrics = detail.metrics.filter((metric) => {
      return new Date(metric.capturedAt).getTime() >= Date.now() - range * 60 * 60 * 1000;
    });
    const rollingAverage = getRollingAverage([...metrics].reverse(), (metric) => metric.vehicleCount).reverse();

    return NextResponse.json({
      camera: detail.camera,
      metrics,
      snapshots: detail.snapshots,
      insight: detail.insight,
      series: metrics
        .slice()
        .reverse()
        .map((metric) => {
          const rolling = rollingAverage.find((point) => point.timestamp === metric.capturedAt);
          return {
            timestamp: metric.capturedAt,
            label: new Date(metric.capturedAt).toLocaleTimeString(locale === "de" ? "de-DE" : "en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            vehicleCount: metric.vehicleCount,
            rollingAverage: rolling ? Number(rolling.value.toFixed(1)) : null,
          };
        }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        camera: null,
        metrics: [],
        snapshots: [],
        series: [],
        insight: null,
        error: error instanceof Error ? error.message : "Scene database not initialized.",
      },
      {
        status: 200,
      },
    );
  }
}
