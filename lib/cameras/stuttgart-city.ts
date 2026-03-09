import { createHash } from "node:crypto";
import { load } from "cheerio";
import cameraSeeds from "../../data/seed/cameras.json";
import type { CameraAdapter, CameraDefinition } from "./types";

function getDefinitions() {
  return (cameraSeeds as CameraDefinition[]).filter((camera) => camera.configJson?.adapter === "stuttgart-city");
}

function toAbsoluteUrl(baseUrl: string, candidate: string) {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function collectCandidates(pageUrl: string, html: string) {
  const $ = load(html);
  const candidates = new Set<string>();

  for (const selector of ["img[src]", "source[src]", "iframe[src]", "a[href$='.jpg']", "a[href$='.jpeg']", "a[href$='.png']"]) {
    $(selector).each((_, element) => {
      const value = $(element).attr("src") ?? $(element).attr("href");
      if (!value) {
        return;
      }

      const absoluteUrl = toAbsoluteUrl(pageUrl, value);
      if (absoluteUrl) {
        candidates.add(absoluteUrl);
      }
    });
  }

  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    const absoluteUrl = toAbsoluteUrl(pageUrl, ogImage);
    if (absoluteUrl) {
      candidates.add(absoluteUrl);
    }
  }

  return [...candidates].filter(
    (candidate) =>
      !candidate.includes("openGraph-200x200") &&
      !candidate.includes("youtube.com") &&
      !candidate.includes("youtu.be") &&
      !candidate.endsWith(".svg"),
  );
}

export const stuttgartCityAdapter: CameraAdapter = {
  key: "stuttgart-city",
  async getCameraDefinitions() {
    return getDefinitions();
  },
  async fetchLatestSnapshot(camera) {
    const response = await fetch(camera.pageUrl, {
      headers: {
        "user-agent": "stuttgart-pulse/scene-mvp",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        capturedAt: new Date().toISOString(),
        sourceUrl: camera.pageUrl,
        degradedReason: `Failed to fetch Stuttgart city webcam page: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();
    const candidates = collectCandidates(camera.pageUrl, html);

    for (const candidate of candidates) {
      const imageResponse = await fetch(candidate, {
        headers: {
          "user-agent": "stuttgart-pulse/scene-mvp",
        },
      });

      if (!imageResponse.ok) {
        continue;
      }

      const contentType = imageResponse.headers.get("content-type");
      if (!contentType?.startsWith("image/")) {
        continue;
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const hash = createHash("sha1").update(imageBuffer).digest("hex");

      return {
        ok: true,
        capturedAt: new Date().toISOString(),
        sourceUrl: candidate,
        contentType,
        imageBuffer,
        hash,
      };
    }

    return {
      ok: false,
      capturedAt: new Date().toISOString(),
      sourceUrl: camera.pageUrl,
      degradedReason:
        "Could not extract a directly fetchable city webcam image from the public page, so the pipeline should fall back to the seeded placeholder.",
    };
  },
  getAttribution(camera) {
    return `${camera.name} • Landeshauptstadt Stuttgart webcam page`;
  },
};
