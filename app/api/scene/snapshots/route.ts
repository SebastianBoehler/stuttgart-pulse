import { NextRequest, NextResponse } from "next/server";
import { getCameraSnapshots } from "@/lib/scene";

export async function GET(request: NextRequest) {
  const cameraId = request.nextUrl.searchParams.get("cameraId");

  if (!cameraId) {
    return NextResponse.json({ error: "cameraId is required." }, { status: 400 });
  }

  try {
    const snapshots = await getCameraSnapshots(cameraId);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      {
        snapshots: [],
        error: error instanceof Error ? error.message : "Scene database not initialized.",
      },
      {
        status: 200,
      },
    );
  }
}
