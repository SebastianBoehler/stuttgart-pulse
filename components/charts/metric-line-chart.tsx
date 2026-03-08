"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateTime, formatMetric } from "@/lib/format";
import type { Locale } from "@/lib/types";

type MetricLineChartProps = {
  data: Array<Record<string, number | string | null>>;
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  height?: number;
  locale?: Locale;
};

export function MetricLineChart({ data, lines, height = 220, locale = "en" }: MetricLineChartProps) {
  const axisColor = "color-mix(in srgb, var(--foreground) 62%, transparent)";

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke={axisColor} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} stroke={axisColor} width={46} />
          <Tooltip
            contentStyle={{
              borderRadius: 20,
              border: "1px solid var(--tooltip-border)",
              background: "var(--tooltip-bg)",
              boxShadow: "var(--shadow)",
              color: "var(--foreground)",
            }}
            formatter={(value) => (typeof value === "number" ? formatMetric(value, "µg/m³", locale) : value ?? "")}
            labelFormatter={(_, payload) => {
              const timestamp = payload?.[0]?.payload?.timestamp;
              return typeof timestamp === "string" ? formatDateTime(timestamp, locale) : "";
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            wrapperStyle={{ fontSize: "12px", paddingBottom: "16px", color: "var(--foreground)" }}
          />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={2.6}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
