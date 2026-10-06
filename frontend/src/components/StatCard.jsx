/**
 * KPI tile for the dashboard and analytics pages.
 *
 * `loading` renders a same-height skeleton rather than collapsing the tile,
 * so a refetch never makes the grid jump.
 */
import { TrendingDown, TrendingUp } from 'lucide-react'

import { useCountUp } from '../hooks/useCountUp.js'
import { cn } from '../utils/cn.js'

const TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/12 dark:text-red-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/12 dark:text-sky-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-400',
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  suffix,
  prefix,
  decimals = 0,
  animate = true,
  loading = false,
  delta,
  onClick,
  className,
}) {
  const numeric = Number(value)
  const canCount = Number.isFinite(numeric)
  const counted = useCountUp(canCount ? numeric : 0, {
    decimals,
    enabled: animate && !loading && canCount,
  })

  const display = loading ? '' : canCount ? counted : (value ?? '—')
  const Trend = delta != null && Number(delta) >= 0 ? TrendingUp : TrendingDown

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'panel flex w-full items-start gap-3.5 p-4 text-left',
        onClick && 'cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lift',
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300',
            TONES[tone] ?? TONES.brand,
          )}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {label}
        </p>

        {loading ? (
          <div className="skeleton mt-2 h-7 w-24" />
        ) : (
          <p className="mt-1 flex flex-wrap items-baseline gap-1">
            {prefix ? (
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{prefix}</span>
            ) : null}
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {display}
            </span>
            {suffix ? (
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{suffix}</span>
            ) : null}
          </p>
        )}

        {hint && !loading ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            {delta != null ? (
              <Trend
                className={cn('size-3 shrink-0', Number(delta) >= 0 ? 'text-emerald-500' : 'text-red-500')}
                aria-hidden="true"
              />
            ) : null}
            <span className="truncate">{hint}</span>
          </p>
        ) : null}
      </div>
    </Tag>
  )
}
