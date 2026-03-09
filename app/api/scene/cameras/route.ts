import { NextResponse } from "next/server";
import { listSceneCameras } from "@/lib/scene";
import { getSceneInsight } from "@/lib/vision/insights";

export async function GET() {
  try {
    const cameras = await listSceneCameras();

    return NextResponse.json({
      cameras: cameras.map((camera) => ({
        ...camera,
        insight: getSceneInsight(camera, camera.latestMetric ? [camera.latestMetric] : [], "en"),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        cameras: [],
        error: error instanceof Error ? error.message : "Scene database not initialized.",
      },
      {
        status: 200,
      },
    );
  }
}
