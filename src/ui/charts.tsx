import type { ReactNode } from 'react';

/**
 * 统计图表：全部用内联样式的 SVG 画。
 * 不用 Tailwind class，导出 PNG 时把 SVG 序列化出去样式才不会丢。
 */

const FONT = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface BarItem {
  label: string;
  value: number;
  color: string;
  hint?: string;
}

export function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="w-full [&_svg]:h-auto [&_svg]:w-full">{children}</div>;
}

/** 折线/面积图：适合看「最近两周复习量」这类趋势 */
export function LineChart({
  points,
  color = '#f97316',
  height = 150,
}: {
  points: ChartPoint[];
  color?: string;
  height?: number;
}) {
  const W = 340;
  const H = height;
  const padding = { top: 16, right: 10, bottom: 22, left: 10 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const xy = points.map((p, i) => ({
    x: padding.left + i * step,
    y: padding.top + innerH - (p.value / max) * innerH,
    ...p,
  }));

  const line = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `M ${padding.left},${padding.top + innerH} L ${line.replace(/ /g, ' L ')} L ${
    padding.left + innerW
  },${padding.top + innerH} Z`;

  return (
    <ChartFrame>
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="趋势图">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((r) => (
          <line
            key={r}
            x1={padding.left}
            x2={padding.left + innerW}
            y1={padding.top + innerH * r}
            y2={padding.top + innerH * r}
            stroke="#f4f4f5"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#lineFill)" />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {xy.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="2" />
            {p.value > 0 && (i === xy.length - 1 || i === 0) && (
              <text
                x={p.x}
                y={p.y - 8}
                fontSize="10"
                fill="#71717a"
                textAnchor={i === 0 ? 'start' : 'end'}
                fontFamily={FONT}
              >
                {p.value}
              </text>
            )}
            {(i === 0 || i === xy.length - 1 || i === Math.floor(xy.length / 2)) && (
              <text
                x={p.x}
                y={H - 6}
                fontSize="9.5"
                fill="#a1a1aa"
                textAnchor={i === 0 ? 'start' : i === xy.length - 1 ? 'end' : 'middle'}
                fontFamily={FONT}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </ChartFrame>
  );
}

/** 横向条形：适合「按科目正确率」这种类目少的对比 */
export function HBars({ items, unit = '', width = 320 }: { items: BarItem[]; unit?: string; width?: number }) {
  const rowH = 26;
  const H = Math.max(rowH, items.length * rowH) + 6;
  const labelW = 78;
  const valueW = 38;
  const barW = width - labelW - valueW - 8;
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ChartFrame>
      <svg viewBox={`0 0 ${width} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="条形图">
        {items.map((item, i) => {
          const y = i * rowH + 6;
          const w = Math.max(2, (item.value / max) * barW);
          return (
            <g key={item.label}>
              <text
                x={0}
                y={y + 12}
                fontSize="10.5"
                fill="#71717a"
                fontFamily={FONT}
              >
                {item.label.length > 6 ? `${item.label.slice(0, 6)}…` : item.label}
              </text>
              <rect x={labelW} y={y + 3} width={barW} height="9" rx="4.5" fill="#f4f4f5" />
              <rect x={labelW} y={y + 3} width={w} height="9" rx="4.5" fill={item.color} />
              <text
                x={width}
                y={y + 12}
                fontSize="10.5"
                fill="#52525b"
                textAnchor="end"
                fontFamily={FONT}
              >
                {item.value}
                {unit}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/** 环形：适合看构成占比（错因、科目题量） */
export function Donut({
  items,
  centerLabel,
  centerValue,
  size = 168,
}: {
  items: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="占比图"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f4f4f5" strokeWidth="16" />
        {total > 0 &&
          items.map((item) => {
            const len = (item.value / total) * circumference;
            const dash = `${Math.max(0, len - 2)} ${circumference - Math.max(0, len - 2)}`;
            const el = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="16"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += len;
            return el;
          })}
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fontSize="18"
          fontWeight="600"
          fill="#18181b"
          fontFamily={FONT}
        >
          {centerValue ?? total}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          fontSize="10"
          fill="#a1a1aa"
          fontFamily={FONT}
        >
          {centerLabel ?? ''}
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="min-w-0 flex-1 truncate text-zinc-600">{item.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-400">
              {item.value}
              {total > 0 && (
                <span className="ml-1 text-zinc-300">{Math.round((item.value / total) * 100)}%</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 竖向柱状：掌握程度这种有顺序的分布 */
export function VBars({ items, height = 150 }: { items: BarItem[]; height?: number }) {
  const W = 320;
  const H = height;
  const padTop = 18;
  const padBottom = 26;
  const innerH = H - padTop - padBottom;
  const max = Math.max(1, ...items.map((i) => i.value));
  const slot = W / Math.max(1, items.length);
  const barW = Math.min(38, slot * 0.5);

  return (
    <ChartFrame>
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="柱状图">
        <line x1="0" x2={W} y1={padTop + innerH} y2={padTop + innerH} stroke="#f4f4f5" strokeWidth="1" />
        {items.map((item, i) => {
          const h = Math.max(3, (item.value / max) * innerH);
          const x = i * slot + (slot - barW) / 2;
          return (
            <g key={item.label}>
              <rect
                x={x}
                y={padTop + innerH - h}
                width={barW}
                height={h}
                rx="4"
                fill={item.color}
              />
              <text
                x={i * slot + slot / 2}
                y={padTop + innerH - h - 6}
                fontSize="10.5"
                fill="#71717a"
                textAnchor="middle"
                fontFamily={FONT}
              >
                {item.value}
              </text>
              <text
                x={i * slot + slot / 2}
                y={H - 8}
                fontSize="10"
                fill="#a1a1aa"
                textAnchor="middle"
                fontFamily={FONT}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
