/**
 * Shared chart scaffolding.
 *
 * `ChartCard` handles the panel chrome, title, legend toggle and the fixed
 * height that keeps a grid of charts aligned. `ChartTooltip` gives every chart
 * the same hover styling instead of each one re-deriving colours.
 */
import { ChartColumnBig, Info } from 'lucide-react'
import { ResponsiveContainer } from 'recharts'

import { cn } from '../../utils/cn.js'
import { Card } from '../UI.jsx'
import { useChartTheme } from './chartTheme.jsx'

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  action,
  height = 280,
  loading = false,
  isEmpty = false,
  emptyMessage = 'No data for this view',
  footer,
  children,
  className,
  bodyClassName,
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className={cn('min-w-0 flex-1 px-2 pb-4', bodyClassName)}>
        {loading ? (
          <div className="skeleton mx-3" style={{ height: height - 16 }} />
        ) : isEmpty ? (
          <div
            className="flex flex-col items-center justify-center gap-2 text-center"
            style={{ height: height - 16 }}
          >
            <ChartColumnBig className="size-7 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="text-xs text-slate-400 dark:text-slate-500">{emptyMessage}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {children}
          </ResponsiveContainer>
        )}
      </div>

      {footer ? (
        <div className="border-t border-slate-200/80 px-5 py-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {footer}
        </div>
      ) : null}
    </Card>
  )
}

/**
 * Custom tooltip body. Expects Recharts' `{ active, payload, label }` shape and
 * reads value formatting from each series' `unit` on the payload entry.
 */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, showTotal = true }) {
  const theme = useChartTheme()
  if (!active || !payload?.length) return null

  const rows = payload.filter((entry) => entry.value !== null && entry.value !== undefined)
  if (!rows.length) return null

  const total = rows.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0)

  return (
    <div
      className="pointer-events-none min-w-40 rounded-xl border px-3 py-2 shadow-lg backdrop-blur-sm"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
      }}
    >
      {label !== undefined && label !== null && label !== '' ? (
        <p className="mb-1.5 border-b border-current/10 pb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}

      <ul className="space-y-1">
        {rows.map((entry) => {
          const numeric = Number(entry.value)
          return (
            <li key={`${entry.dataKey}-${entry.name}`} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color || entry.stroke || theme.text }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
                {entry.name}
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {valueFormatter
                  ? valueFormatter(numeric, entry)
                  : numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </li>
          )
        })}
      </ul>

      {showTotal && rows.length > 1 ? (
        <p className="mt-1.5 flex items-center justify-between border-t border-current/10 pt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Total</span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
            {total.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </p>
      ) : null}
    </div>
  )
}

/** Legend that wraps gracefully on narrow screens. */
export function ChartLegend({ items, className }) {
  if (!items?.length) return null
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 pb-1', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/** Footnote used to disclose how a chart's values were produced. */
export function ChartFootnote({ children }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
      <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
