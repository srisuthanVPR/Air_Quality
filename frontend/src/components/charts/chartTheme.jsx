/**
 * Shared Recharts configuration.
 *
 * Recharts defaults are tuned for a white canvas; on a dark background the
 * default grid and axis colours disappear. Everything visual is derived from
 * the active theme here so each chart only has to declare its data.
 */
import { useTheme } from '../../hooks/useTheme.jsx'

export const SERIES_COLORS = [
  '#0d9488', // teal
  '#f97316', // orange
  '#0ea5e9', // sky
  '#a855f7', // violet
  '#10b981', // emerald
  '#eab308', // yellow
  '#ec4899', // pink
  '#64748b', // slate
  '#ef4444', // red
  '#14b8a6', // brand-500
  '#8b5cf6',
  '#f59e0b',
]

/** Categorical scale matching SERIES_COLORS. */
export const categorical = (index) => SERIES_COLORS[index % SERIES_COLORS.length]

export function useChartTheme() {
  const { isDark } = useTheme()

  return {
    isDark,
    // Recharts wants concrete strings, not CSS variables.
    grid: isDark ? '#1e293b' : '#e2e8f0',
    axis: isDark ? '#475569' : '#cbd5e1',
    tick: isDark ? '#94a3b8' : '#64748b',
    text: isDark ? '#e2e8f0' : '#334155',
    surface: isDark ? '#0f172a' : '#ffffff',
    tooltipBg: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    /** Props spread onto every `<CartesianGrid>`. */
    gridProps: {
      stroke: isDark ? '#1e293b' : '#e2e8f0',
      strokeDasharray: '3 3',
      vertical: false,
    },
    /** Props spread onto every `<XAxis>`. */
    xAxisProps: {
      stroke: axisOf(isDark),
      tick: { fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      tickLine: false,
      axisLine: { stroke: axisOf(isDark) },
      minTickGap: 8,
    },
    /** Props spread onto every `<YAxis>`. */
    yAxisProps: {
      stroke: axisOf(isDark),
      tick: { fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      tickLine: false,
      axisLine: false,
      width: 52,
    },
  }
}

const axisOf = (isDark) => (isDark ? '#334155' : '#e2e8f0')

/** Standard animation props; disabled under reduced-motion. */
export function useChartAnimation(duration = 650) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return { isAnimationActive: !reduced, animationDuration: duration, animationEasing: 'ease-out' }
}

/**
 * Formats an axis tick so large magnitudes stay short.
 * 1200 -> "1.2k", 2500000 -> "2.5M".
 */
export function axisTickFormatter(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value ?? '')
  const abs = Math.abs(number)
  if (abs >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(number / 1000).toFixed(0)}k`
  if (abs >= 1000) return `${(number / 1000).toFixed(1)}k`
  if (abs >= 10) return number.toFixed(0)
  if (Number.isInteger(number)) return String(number)
  return number.toFixed(1)
}

/**
 * Gradient fill for area/line charts.
 * `<defs>` must sit inside the chart's children; ids are unique per chart.
 */
export function gradientFill(id, color, { fromOpacity = 0.32, toOpacity = 0.02 } = {}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={fromOpacity} />
      <stop offset="100%" stopColor={color} stopOpacity={toOpacity} />
    </linearGradient>
  )
}

/** Abbreviates a feature name for a cramped axis tick. */
export function shortFeature(name) {
  if (typeof name !== 'string') return name
  const sensor = name.match(/^PT\d{2}\.S(\d+)\(/)
  if (sensor) return `S${sensor[1]}`
  return name.replace(/\((?:GT|NMHC)\)/, '')
}
