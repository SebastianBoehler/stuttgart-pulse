import type { SceneMetricRecord } from "@/lib/types";

export function getRollingAverage(metrics: SceneMetricRecord[], accessor: (metric: SceneMetricRecord) => number, windowSize = 4) {
  return metrics.map((metric, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = metrics.slice(start, index + 1);
    const total = slice.reduce((sum, item) => sum + accessor(item), 0);

    return {
      timestamp: metric.capturedAt,
      value: total / slice.length,
    };
  });
}

export function getWeekdayBaseline(metrics: SceneMetricRecord[], target: SceneMetricRecord | null | undefined) {
  if (!target) {
    return null;
  }

  const targetDate = new Date(target.capturedAt);
  const baselineCandidates = metrics.filter((metric) => {
    const date = new Date(metric.capturedAt);
    return (
      metric.id !== target.id &&
      date.getUTCDay() === targetDate.getUTCDay() &&
      date.getUTCHours() === targetDate.getUTCHours()
    );
  });

  if (baselineCandidates.length === 0) {
    return null;
  }

  const total = baselineCandidates.reduce((sum, metric) => sum + metric.vehicleCount, 0);
  return total / baselineCandidates.length;
}

export function getAnomalyScore(metrics: SceneMetricRecord[], target: SceneMetricRecord | null | undefined) {
  const baseline = getWeekdayBaseline(metrics, target);
  if (!target || baseline === null || baseline <= 0) {
    return null;
  }

  return (target.vehicleCount - baseline) / baseline;
}
