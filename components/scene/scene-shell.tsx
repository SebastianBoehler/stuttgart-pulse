"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Camera, CloudFog, Plane, TrafficCone, TrendingUp } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Locale, SceneCameraListItem, SceneMetricRecord, SceneSnapshotRecord } from "@/lib/types";
import { MetricLineChart } from "@/components/charts/metric-line-chart";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SceneMap = dynamic(() => import("@/components/map/scene-map").then((module) => module.SceneMap), {
  ssr: false,
  loading: () => <div className="surface-soft h-full min-h-[520px] animate-pulse rounded-[32px]" />,
});

type SceneMetricsResponse = {
  camera: SceneCameraListItem | null;
  metrics: SceneMetricRecord[];
  snapshots: SceneSnapshotRecord[];
  series: Array<{
    timestamp: string;
    label: string;
    vehicleCount: number;
    rollingAverage: number | null;
  }>;
  insight: string | null;
};

type SceneShellProps = {
  locale: Locale;
  dictionary: Dictionary;
};

function getSourceTypeLabel(sourceType: string, dictionary: Dictionary) {
  if (sourceType === "traffic") return dictionary.scene.traffic;
  if (sourceType === "airport") return dictionary.scene.airport;
  return dictionary.scene.city;
}

function getSourceIcon(sourceType: string) {
  if (sourceType === "traffic") return TrafficCone;
  if (sourceType === "airport") return Plane;
  return Camera;
}

function SceneImage({
  src,
  alt,
  emptyLabel,
}: {
  src: string;
  alt: string;
  emptyLabel: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="surface-soft flex aspect-[16/9] items-center justify-center p-6 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="aspect-[16/9] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function SceneShell({ locale, dictionary }: SceneShellProps) {
  const [cameras, setCameras] = useState<SceneCameraListItem[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "traffic" | "city" | "airport">("all");
  const [detail, setDetail] = useState<SceneMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCameras() {
      setLoading(true);
      try {
        const response = await fetch("/api/scene/cameras");
        const payload = (await response.json()) as { cameras: SceneCameraListItem[]; error?: string };
        setCameras(payload.cameras);
        setSelectedCameraId((current) => current ?? payload.cameras[0]?.id ?? null);
        setError(payload.error ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load scene cameras.");
      } finally {
        setLoading(false);
      }
    }

    void loadCameras();
  }, []);

  useEffect(() => {
    if (!selectedCameraId) {
      setDetail(null);
      return;
    }

    async function loadDetail() {
      const response = await fetch(`/api/scene/metrics?cameraId=${selectedCameraId}&range=24h&locale=${locale}`);
      const payload = (await response.json()) as SceneMetricsResponse & { error?: string };
      setDetail(payload);
      if (payload.error) {
        setError(payload.error);
      }
    }

    void loadDetail();
  }, [locale, selectedCameraId]);

  const filteredCameras = useMemo(() => {
    return cameras.filter((camera) => sourceFilter === "all" || camera.sourceType === sourceFilter);
  }, [cameras, sourceFilter]);

  useEffect(() => {
    if (!filteredCameras.find((camera) => camera.id === selectedCameraId)) {
      setSelectedCameraId(filteredCameras[0]?.id ?? null);
    }
  }, [filteredCameras, selectedCameraId]);

  const selectedCamera = filteredCameras.find((camera) => camera.id === selectedCameraId) ?? null;
  const findings = filteredCameras
    .map((camera) => ({
      camera,
      insight: camera.latestMetric
        ? camera.latestMetric.anomalyScore !== null && Math.abs(camera.latestMetric.anomalyScore) >= 0.15
          ? `${camera.name}: ${camera.latestMetric.anomalyScore > 0 ? "+" : ""}${Math.round(camera.latestMetric.anomalyScore * 100)}% ${dictionary.scene.anomaly.toLowerCase()}`
          : `${camera.name}: ${camera.latestMetric.vehicleCount} ${dictionary.scene.totalVehicles.toLowerCase()}`
        : null,
    }))
    .filter((item): item is { camera: SceneCameraListItem; insight: string } => item.insight !== null)
    .slice(0, 3);
  const activeFeedCount = cameras.filter((camera) => camera.active).length;

  return (
    <div className="pb-12">
      <SiteHeader locale={locale} dictionary={dictionary} pathSuffix="/scene" />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 md:px-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
          <Card className="overflow-hidden rounded-[32px] border-none shadow-none">
            <CardHeader className="gap-4 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <Badge className="bg-accent-soft text-accent-strong">{dictionary.scene.badge}</Badge>
                  <CardTitle className="font-display text-4xl leading-tight">{dictionary.scene.title}</CardTitle>
                  <CardDescription className="max-w-2xl leading-6">{dictionary.scene.description}</CardDescription>
                </div>
                <div className="surface-soft rounded-[24px] p-4 text-sm leading-6 text-muted">
                  <p>{dictionary.scene.setupNotice}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { key: "all", label: dictionary.scene.allSources },
                  { key: "traffic", label: dictionary.scene.traffic },
                  { key: "city", label: dictionary.scene.city },
                  { key: "airport", label: dictionary.scene.airport },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSourceFilter(option.key as typeof sourceFilter)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      sourceFilter === option.key
                        ? "border-accent bg-accent-soft text-accent-strong"
                        : "border-line bg-card text-foreground/72 hover:bg-surface-soft hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="surface-inverse rounded-[28px] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">{dictionary.scene.activeFeeds}</p>
                  <p className="mt-3 text-3xl font-semibold">{activeFeedCount}</p>
                </div>
                <div className="surface-soft rounded-[28px] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{dictionary.scene.cameras}</p>
                  <p className="mt-3 text-3xl font-semibold">{filteredCameras.length}</p>
                </div>
                <div className="surface-soft rounded-[28px] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{dictionary.scene.latestMetrics}</p>
                  <p className="mt-3 text-3xl font-semibold">{cameras.filter((camera) => camera.latestMetric).length}</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dictionary.scene.mapLabel}</p>
                    </div>
                    {loading ? <span className="text-sm text-muted">{dictionary.common.noData}</span> : null}
                  </div>
                  <SceneMap cameras={filteredCameras} selectedCameraId={selectedCameraId} onSelect={setSelectedCameraId} />
                </div>

                <div className="space-y-3">
                  {filteredCameras.map((camera) => {
                    const Icon = getSourceIcon(camera.sourceType);
                    const isSelected = selectedCameraId === camera.id;

                    return (
                      <button
                        key={camera.id}
                        type="button"
                        onClick={() => setSelectedCameraId(camera.id)}
                        className={`w-full rounded-[26px] border p-4 text-left transition-colors ${
                          isSelected
                            ? "border-accent bg-accent-soft/80"
                            : "border-line bg-card hover:bg-surface-soft"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 rounded-2xl bg-card-strong p-2">
                              <Icon className="size-4 text-accent" />
                            </div>
                            <div>
                              <p className="font-semibold">{camera.name}</p>
                              <p className="text-sm text-muted">{getSourceTypeLabel(camera.sourceType, dictionary)}</p>
                            </div>
                          </div>
                          <Badge className={camera.active ? "bg-accent text-white" : "bg-card-strong text-muted"}>
                            {camera.active ? dictionary.scene.statusActive : dictionary.scene.statusInactive}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                          <div className="surface-soft rounded-2xl p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted">{dictionary.scene.totalVehicles}</p>
                            <p className="mt-2 text-lg font-semibold">{camera.latestMetric?.vehicleCount ?? "—"}</p>
                          </div>
                          <div className="surface-soft rounded-2xl p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted">{dictionary.scene.visibility}</p>
                            <p className="mt-2 text-lg font-semibold">
                              {camera.latestMetric?.visibilityScore !== null && camera.latestMetric?.visibilityScore !== undefined
                                ? `${Math.round(camera.latestMetric.visibilityScore * 100)}%`
                                : "—"}
                            </p>
                          </div>
                          <div className="surface-soft rounded-2xl p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted">{dictionary.scene.anomaly}</p>
                            <p className="mt-2 text-lg font-semibold">
                              {camera.latestMetric?.anomalyScore !== null && camera.latestMetric?.anomalyScore !== undefined
                                ? `${camera.latestMetric.anomalyScore > 0 ? "+" : ""}${Math.round(camera.latestMetric.anomalyScore * 100)}%`
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[32px]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">{dictionary.scene.findings}</CardTitle>
                <CardDescription>{dictionary.scene.findingsDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {findings.length > 0 ? (
                  findings.map((item) => (
                    <div key={item.camera.id} className="surface-soft rounded-[24px] p-4 text-sm leading-6">
                      {item.insight}
                    </div>
                  ))
                ) : (
                  <div className="surface-soft rounded-[24px] p-4 text-sm leading-6 text-muted">{dictionary.scene.noFindings}</div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[32px]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">{dictionary.scene.detailTitle}</CardTitle>
                <CardDescription>
                  {selectedCamera ? selectedCamera.source : dictionary.scene.detailEmpty}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCamera ? (
                  <>
                    <div className="overflow-hidden rounded-[28px] border border-line bg-card-strong">
                      {detail?.snapshots?.[0]?.storagePath || selectedCamera.latestSnapshot?.storagePath ? (
                        <SceneImage
                          key={detail?.snapshots?.[0]?.storagePath ?? selectedCamera.latestSnapshot?.storagePath ?? ""}
                          src={detail?.snapshots?.[0]?.storagePath ?? selectedCamera.latestSnapshot?.storagePath ?? ""}
                          alt={selectedCamera.name}
                          emptyLabel={dictionary.scene.noReplay}
                        />
                      ) : (
                        <div className="surface-soft flex aspect-[16/9] items-center justify-center p-6 text-sm text-muted">
                          {dictionary.scene.noReplay}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="surface-soft rounded-[24px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">{dictionary.scene.detailSource}</p>
                        <p className="mt-2 font-semibold">{selectedCamera.source}</p>
                      </div>
                      <div className="surface-soft rounded-[24px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">{dictionary.scene.detailRefresh}</p>
                        <p className="mt-2 font-semibold">{selectedCamera.refreshSeconds}s</p>
                      </div>
                      <div className="surface-soft rounded-[24px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">{dictionary.scene.detailUpdated}</p>
                        <p className="mt-2 font-semibold">
                          {selectedCamera.latestSnapshot
                            ? formatDateTime(selectedCamera.latestSnapshot.capturedAt, locale)
                            : dictionary.scene.detailNoMetrics}
                        </p>
                      </div>
                      <div className="surface-soft rounded-[24px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">{dictionary.scene.weather}</p>
                        <p className="mt-2 font-semibold">{selectedCamera.latestMetric?.weatherLabel ?? "—"}</p>
                      </div>
                    </div>

                    <div className="surface-soft rounded-[24px] p-4 text-sm leading-6">
                      {detail?.insight ?? dictionary.scene.insightFallback}
                    </div>

                    {!selectedCamera.active ? (
                      <div className="rounded-[24px] border border-dashed border-line p-4 text-sm text-muted">
                        {selectedCamera.configJson?.statusReason ?? dictionary.scene.sourceUnavailable}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="surface-soft rounded-[24px] p-4 text-sm text-muted">{dictionary.scene.detailEmpty}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <Card className="rounded-[32px]">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-display text-2xl">{dictionary.scene.chartTitle}</CardTitle>
                  <CardDescription>{dictionary.scene.chartDescription}</CardDescription>
                </div>
                <div className="rounded-full bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">
                  <span className="inline-flex items-center gap-2">
                    <TrendingUp className="size-4" />
                    24h
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {detail?.series?.length ? (
                <MetricLineChart
                  data={detail.series}
                  lines={[
                    { dataKey: "vehicleCount", name: dictionary.scene.totalVehicles, color: "var(--accent)" },
                    { dataKey: "rollingAverage", name: "Rolling avg", color: "var(--amber)" },
                  ]}
                  locale={locale}
                  valueFormatter={(value) => (typeof value === "number" ? `${Math.round(value)}` : String(value ?? ""))}
                  height={280}
                />
              ) : (
                <div className="surface-soft flex min-h-[280px] items-center justify-center rounded-[24px] p-6 text-sm text-muted">
                  {dictionary.scene.detailNoMetrics}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[32px]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">{dictionary.scene.classBreakdown}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedCamera?.latestMetric ? (
                  [
                    { label: "Cars", value: selectedCamera.latestMetric.carCount },
                    { label: "Trucks", value: selectedCamera.latestMetric.truckCount },
                    { label: "Buses", value: selectedCamera.latestMetric.busCount },
                    { label: "Bikes", value: selectedCamera.latestMetric.bikeCount },
                    { label: "Motorcycles", value: selectedCamera.latestMetric.motorcycleCount },
                  ].map((item) => (
                    <div key={item.label} className="surface-soft flex items-center justify-between rounded-[22px] px-4 py-3">
                      <span className="text-sm">{item.label}</span>
                      <span className="text-lg font-semibold">{item.value}</span>
                    </div>
                  ))
                ) : (
                  <div className="surface-soft rounded-[24px] p-4 text-sm text-muted">{dictionary.scene.detailNoMetrics}</div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[32px]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CloudFog className="size-5 text-accent" />
                  <CardTitle className="font-display text-2xl">{dictionary.scene.replay}</CardTitle>
                </div>
                <CardDescription>{dictionary.scene.replayDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                {detail?.snapshots?.length ? (
                  <div className="grid gap-3">
                    {detail.snapshots.slice(0, 4).map((snapshot) => (
                      <div key={snapshot.id} className="overflow-hidden rounded-[22px] border border-line">
                        <SceneImage
                          key={snapshot.storagePath}
                          src={snapshot.storagePath}
                          alt={selectedCamera?.name ?? "Scene snapshot"}
                          emptyLabel={dictionary.scene.noReplay}
                        />
                        <div className="surface-soft px-4 py-3 text-xs text-muted">
                          {formatDateTime(snapshot.capturedAt, locale)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="surface-soft rounded-[24px] p-4 text-sm text-muted">{dictionary.scene.noReplay}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {error ? <p className="px-2 text-sm text-muted">{error}</p> : null}
      </main>
    </div>
  );
}
