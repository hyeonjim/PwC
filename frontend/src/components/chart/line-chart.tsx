// 선 차트. 회색이 기본이고 emphasis 시리즈 하나만 주황으로 그린다.
// 나타날 때 왼쪽에서 오른쪽으로 그려지는 효과는 globals.css 의 .chart-lines 에 있다.

export type LineChartSeries = { label: string; values: (number | null)[]; emphasis?: boolean };

type LineChartProps = {
  /** 화면 낭독기용 한 줄 설명 */
  description: string;
  /** 가로축 이름표. values 와 길이가 같다. */
  labels: string[];
  series: LineChartSeries[];
  /** 점선 기준선 (예: 약정 최소 잔액) */
  threshold?: { value: number; label: string };
  formatValue?: (value: number) => string;
  height?: number;
};

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 100;
const GRID_LINE_COUNT = 4;
const MAX_AXIS_LABELS = 7;

/** null 에서 끊기는 선 조각들의 좌표 문자열 */
function getLineSegments(values: (number | null)[], toY: (value: number) => number) {
  const stepX = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0;
  const segments: string[][] = [[]];
  values.forEach((value, index) => {
    if (value == null) segments.push([]);
    else segments[segments.length - 1].push(`${(index * stepX).toFixed(1)},${toY(value).toFixed(2)}`);
  });
  return segments.filter((segment) => segment.length > 1).map((segment) => segment.join(" "));
}

export function LineChart({ description, labels, series, threshold, formatValue = (value) => value.toLocaleString("ko-KR"), height = 220 }: LineChartProps) {
  const allValues = series.flatMap((line) => line.values.filter((value): value is number => value != null));
  if (threshold) allValues.push(threshold.value);
  if (allValues.length === 0) return null;

  const low = Math.min(...allValues);
  const high = Math.max(...allValues);
  const padding = (high - low || Math.abs(high) || 1) * 0.1;
  const axisMin = low - padding;
  const axisMax = high + padding;
  const toPercent = (value: number) => ((axisMax - value) / (axisMax - axisMin)) * 100;
  const toY = (value: number) => (toPercent(value) / 100) * VIEW_HEIGHT;

  const gridValues = Array.from({ length: GRID_LINE_COUNT }, (_, index) => axisMax - ((axisMax - axisMin) * index) / (GRID_LINE_COUNT - 1));
  const labelStep = Math.max(1, Math.ceil(labels.length / MAX_AXIS_LABELS));
  const axisLabels = labels.filter((_, index) => index % labelStep === 0);
  // 강조 시리즈를 마지막에 그려 위에 오게 한다.
  const orderedSeries = [...series].sort((a, b) => Number(a.emphasis ?? false) - Number(b.emphasis ?? false));

  return (
    <figure className="chart">
      {series.length > 1 && (
        <figcaption className="chart-legend">
          {series.map((line) => (
            <span key={line.label} className="chart-legend-item">
              <span className="chart-legend-line" style={{ background: line.emphasis ? "var(--chart-emphasis)" : "var(--chart-neutral)" }} />
              {line.label}
            </span>
          ))}
        </figcaption>
      )}
      <div className="chart-body" style={{ height }}>
        <div className="chart-axis-y" aria-hidden="true">
          {gridValues.map((value) => (
            <span key={value} style={{ top: `${toPercent(value)}%` }}>
              {formatValue(value)}
            </span>
          ))}
        </div>
        <div className="chart-plot">
          {gridValues.map((value) => (
            <div key={value} className="chart-grid-line" style={{ top: `${toPercent(value)}%` }} />
          ))}
          {threshold && (
            <>
              <div className="chart-threshold" style={{ top: `${toPercent(threshold.value)}%` }} />
              <span className="chart-threshold-label" style={{ top: `calc(${toPercent(threshold.value)}% + 4px)` }}>
                {threshold.label}
              </span>
            </>
          )}
          <svg className="chart-lines" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={description}>
            {orderedSeries.map((line) =>
              getLineSegments(line.values, toY).map((points, index) => (
                <polyline
                  key={`${line.label}-${index}`}
                  points={points}
                  fill="none"
                  stroke={line.emphasis ? "var(--chart-emphasis)" : "var(--chart-neutral)"}
                  strokeWidth={line.emphasis ? 2.5 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )),
            )}
          </svg>
        </div>
      </div>
      <div className="chart-axis-x" aria-hidden="true">
        {axisLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </figure>
  );
}
