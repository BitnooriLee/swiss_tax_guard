import { useMemo, useState } from "react";

import { formatCHF } from "../lib/format-chf";

type AssetHistoryPoint = {
  date: string;
  totalAmount: bigint;
};

type ChartPoint = {
  date: string;
  amountRappen: bigint;
  amountChf: number;
};

type Props = {
  points: AssetHistoryPoint[];
  isPending?: boolean;
};

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toLocaleDateString("de-CH", { day: "2-digit", month: "short" });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildXAxisLabelIndices(pointCount: number): number[] {
  if (pointCount <= 0) return [];
  if (pointCount === 1) return [0];

  const desiredTicks = pointCount >= 90 ? 4 : pointCount >= 30 ? 5 : 4;
  const step = Math.max(1, Math.floor((pointCount - 1) / (desiredTicks - 1)));
  const indices = new Set<number>([0, pointCount - 1]);
  for (let i = step; i < pointCount - 1; i += step) {
    indices.add(i);
    if (indices.size >= desiredTicks) break;
  }
  return [...indices].sort((a, b) => a - b);
}

export default function AssetHistoryChart({ points, isPending = false }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      points.map((point) => ({
        date: point.date,
        amountRappen: point.totalAmount,
        // BigInt -> Number conversion only for chart positioning.
        amountChf: Number(point.totalAmount) / 100,
      })),
    [points],
  );

  const viewWidth = chartPoints.length > 30 ? 140 : 100;
  const viewHeight = 44;
  const padX = 4;
  const padTop = 3;
  const padBottom = 5;
  const usableWidth = viewWidth - padX * 2;
  const usableHeight = viewHeight - padTop - padBottom;
  const minY =
    chartPoints.length > 0
      ? Math.min(...chartPoints.map((point) => point.amountChf))
      : 0;
  const maxY =
    chartPoints.length > 0
      ? Math.max(...chartPoints.map((point) => point.amountChf))
      : 0;
  const yRange = maxY - minY || 1;

  const coords = chartPoints.map((point, index) => {
    const progress =
      chartPoints.length <= 1 ? 0 : index / (chartPoints.length - 1);
    const x = padX + progress * usableWidth;
    const normalized = (point.amountChf - minY) / yRange;
    const y = padTop + (1 - normalized) * usableHeight;
    return { x, y, ...point };
  });

  const linePath =
    coords.length === 0
      ? ""
      : coords
          .map((point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`,
          )
          .join(" ");

  const areaPath =
    coords.length === 0
      ? ""
      : `${linePath} L ${coords.at(-1)!.x.toFixed(3)} ${(viewHeight - padBottom).toFixed(3)} L ${coords[0].x.toFixed(3)} ${(viewHeight - padBottom).toFixed(3)} Z`;

  const hoveredPoint = hoveredIndex === null ? null : coords[hoveredIndex] ?? null;
  const xAxisLabelIndices = buildXAxisLabelIndices(coords.length);

  return (
    <section
      className="rounded-xl border border-border bg-card p-6 shadow-sm"
      data-testid="asset-history-chart"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Net Worth Trend</h2>
        <p className="text-sm text-muted-foreground">
          Daily cumulative balance from immutable ledger activity.
        </p>
      </div>

      <div
        className="relative mt-5 w-full overflow-hidden rounded-lg border border-border/60 bg-background/60"
        style={{ aspectRatio: "21 / 9" }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {coords.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No history yet
          </div>
        ) : (
          <>
            <svg
              className={`h-full w-full transition-opacity duration-150 ${isPending ? "opacity-70" : "opacity-100"}`}
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              preserveAspectRatio="none"
              aria-label="Net worth trend line chart"
              role="img"
            >
              <defs>
                <linearGradient id="asset-history-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#asset-history-fill)" />
              <path
                d={linePath}
                fill="none"
                stroke="#10b981"
                strokeWidth={0.75}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {hoveredPoint ? (
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r={0.95}
                  fill="#10b981"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>

            <div className="absolute inset-0 flex">
              {coords.map((point, index) => (
                <button
                  key={point.date}
                  type="button"
                  data-testid="asset-history-point"
                  className="h-full flex-1 cursor-default bg-transparent"
                  aria-label={`${point.date} CHF ${formatCHF(point.amountRappen)}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                />
              ))}
            </div>

            {hoveredPoint ? (
              <div
                className="pointer-events-none absolute z-10 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur"
                style={{
                  left: `calc(${((hoveredPoint.x / viewWidth) * 100).toFixed(3)}% - 46px)`,
                  top: `${clamp((hoveredPoint.y / viewHeight) * 100 - 22, 4, 78).toFixed(2)}%`,
                }}
              >
                <p className="text-muted-foreground">{formatDateLabel(hoveredPoint.date)}</p>
                <p className="font-medium tabular-nums text-foreground">
                  CHF {formatCHF(hoveredPoint.amountRappen)}
                </p>
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-1 h-4 px-2">
              {xAxisLabelIndices.map((index) => {
                const point = coords[index];
                if (!point) return null;
                return (
                  <span
                    key={`${point.date}-axis`}
                    className="absolute -translate-x-1/2 text-[10px] text-muted-foreground/80"
                    style={{
                      left: `${((point.x / viewWidth) * 100).toFixed(3)}%`,
                    }}
                  >
                    {formatDateLabel(point.date)}
                  </span>
                );
              })}
            </div>

            {isPending ? (
              <div className="pointer-events-none absolute inset-0 animate-pulse bg-background/15" />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
