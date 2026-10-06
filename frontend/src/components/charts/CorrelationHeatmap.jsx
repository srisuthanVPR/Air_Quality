/**
 * Correlation heatmap.
 *
 * Built from CSS grid rather than a charting library: a 12x12 matrix of labelled
 * cells needs hover tooltips, sticky row headers and colour-mapped cells, all of
 * which Recharts does not do without a lot of custom SVG work.
 */
import { Fragment, useState } from 'react'

import { useTheme } from '../../hooks/useTheme.jsx'
import { cn } from '../../utils/cn.js'
import { decimal, humanize } from '../../utils/formatters.js'
import { Card } from '../UI.jsx'

/**
 * Diverging red-blue scale centred on zero, so "no relationship" is neutral
 * rather than looking like a strong value.
 */
function cellColor(value, isDark) {
  const magnitude = Math.min(Math.abs(value), 1)
  // Slightly desaturated in dark mode so bright cells do not glare.
  const alpha = 0.12 + magnitude * 0.78
  if (value >= 0) return `rgba(220, 38, 38, ${isDark ? alpha * 0.72 : alpha})`
  return `rgba(37, 99, 235, ${isDark ? alpha * 0.72 : alpha})`
}

export function CorrelationHeatmap({
  columns = [],
  matrix = [],
  title = 'Feature correlation matrix',
  subtitle,
  height,
  onSelect,
  selected,
  className,
}) {
  const [hovered, setHovered] = useState(null)
  const { isDark } = useTheme()

  if (!columns.length || !matrix.length) return null

  const lookUp = (row, col) => matrix.find((entry) => entry.row === row)?.[col] ?? null

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>

      <div className="scroll-fade-x px-2 pb-2" style={height ? { maxHeight: height } : undefined}>
        <div
          className="min-w-max"
          style={{
            display: 'grid',
            gridTemplateColumns: `minmax(4.5rem, 8rem) repeat(${columns.length}, minmax(1.9rem, 1fr))`,
          }}
        >
          {/* Corner + column headers */}
          <div className="sticky left-0 z-20 bg-white dark:bg-slate-900" />
          {columns.map((column) => (
            <div
              key={`head-${column}`}
              title={humanize(column)}
              className="flex items-end justify-center px-0.5 pb-1.5"
            >
              <span className="line-clamp-2 text-center text-[9px] leading-tight font-bold text-slate-500 dark:text-slate-400 [writing-mode:vertical-rl]">
                {column}
              </span>
            </div>
          ))}

          {/* Body */}
          {matrix.map((row) => (
            <Fragment key={`row-${row.row}`}>
              <div className="sticky left-0 z-10 flex items-center justify-end bg-white pr-2 dark:bg-slate-900">
                <span
                  className="truncate text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                  title={row.row}
                >
                  {row.row}
                </span>
              </div>

              {columns.map((column) => {
                const value = lookUp(row.row, column)
                const isDiagonal = row.row === column
                const isSelected = selected === `${row.row}|${column}`

                return (
                  <button
                    key={`${row.row}-${column}`}
                    type="button"
                    title={`${row.row} vs ${column}: ${decimal(value, 3)}`}
                    onMouseEnter={() => setHovered(`${row.row}|${column}`)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(`${row.row}|${column}`)}
                    onBlur={() => setHovered(null)}
                    onClick={() => onSelect?.(`${row.row}|${column}`)}
                    aria-label={`${row.row} correlated with ${column}: ${decimal(value, 3)}`}
                    className={cn(
                      'mx-0.5 my-0.5 grid aspect-square place-items-center rounded-[5px] text-[9px] font-bold transition-all duration-150',
                      isDiagonal && 'opacity-45',
                      hovered === `${row.row}|${column}` && 'scale-110 ring-2 ring-slate-900/40 dark:ring-white/50',
                      isSelected && 'ring-2 ring-brand-500',
                    )}
                    style={{
                      backgroundColor: isDiagonal ? 'rgb(100 116 139 / 0.35)' : cellColor(value, isDark),
                    }}
                  >
                    <span
                      className={
                        Math.abs(value) > 0.55
                          ? 'text-white drop-shadow-sm'
                          : 'text-slate-700 dark:text-slate-200'
                      }
                    >
                      {Math.abs(value) === 1 ? '' : value?.toFixed(1).replace('0.', '.')}
                    </span>
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span>-1.0</span>
          <span className="h-2 w-28 rounded-full bg-gradient-to-r from-blue-600 via-slate-300 to-red-600" />
          <span>+1.0</span>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          Red = co-vary · Blue = inverse · diagonal = perfect self-correlation
        </p>
      </div>
    </Card>
  )
}
