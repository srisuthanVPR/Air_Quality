/**
 * Shared UI primitives.
 *
 * Kept in one module because these are the pieces every page composes from;
 * splitting each into its own file would add navigation overhead without
 * adding clarity. Anything bigger (charts, dropzones, workflow diagrams) lives
 * in its own file.
 */
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  Inbox,
  Loader2,
  RefreshCw,
  ServerCrash,
  TriangleAlert,
} from 'lucide-react'

import { cn } from '../utils/cn.js'

// ------------------------------------------------------------------ Card ----

export function Card({ className, children, hover = false, as: Tag = 'div', ...props }) {
  return (
    <Tag className={cn('panel', hover && 'panel-hover', className)} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, subtitle, icon: Icon, action, className, children }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-400">
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          {title ? <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">{title}</h2> : null}
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
          {children}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- Badge -----

export function Badge({ children, className, color, dot = false, icon: Icon }) {
  return (
    <span className={cn('badge', className)}>
      {dot ? (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color ?? 'currentColor' }}
          aria-hidden="true"
        />
      ) : null}
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/** Neutral badge for counts and metadata. */
export const NeutralBadge = ({ children, className }) => (
  <span
    className={cn(
      'badge bg-slate-100 text-slate-600 ring-1 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/20',
      className,
    )}
  >
    {children}
  </span>
)

// --------------------------------------------------------------- Button -----

const BUTTON_VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

export function Button({
  children,
  variant = 'secondary',
  size,
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  className,
  disabled,
  ...props
}) {
  const spinner = <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BUTTON_VARIANTS[variant], size === 'sm' && 'btn-sm', className)}
      {...props}
    >
      {loading ? spinner : Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      {children}
      {IconRight ? <IconRight className="size-4 shrink-0" aria-hidden="true" /> : null}
    </button>
  )
}

/** Icon-only button. `label` is required - it becomes the accessible name. */
export function IconButton({ icon: Icon, label, variant = 'ghost', className, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        BUTTON_VARIANTS[variant],
        'size-9 shrink-0 p-0',
        variant === 'ghost' && 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
        className,
      )}
      {...props}
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </button>
  )
}

// --------------------------------------------------------------- States ----

/** Full-panel loading placeholder with a matching skeleton layout. */
export function LoadingState({ label = 'Loading', rows = 3, className }) {
  return (
    <div className={cn('px-5 py-6', className)} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="skeleton size-9 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3" style={{ width: `${88 - index * 14}%` }} />
              <div className="skeleton h-2.5" style={{ width: `${62 - index * 12}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Error panel with an offline hint and a retry button. */
export function ErrorState({ error, onRetry, className, compact = false }) {
  const offline = error?.isOffline || error?.code === 'network_error'
  const Icon = offline ? ServerCrash : TriangleAlert
  const title = offline ? 'Cannot reach the backend' : (error?.title ?? 'Something went wrong')

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-xl border border-red-200 bg-red-50/70 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200',
        compact ? 'p-3.5' : 'p-5',
        className,
      )}
    >
      <Icon className={cn('shrink-0', offline ? 'text-red-500' : 'text-red-500')} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold', compact ? 'text-sm' : 'text-sm font-bold')}>{title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{error?.message}</p>
        {error?.hint ? (
          <p className="mt-1.5 text-xs leading-relaxed opacity-75">{error.hint}</p>
        ) : null}
        {Array.isArray(error?.fields) && error.fields.length > 1 ? (
          <ul className="mt-2 space-y-0.5 text-xs opacity-80">
            {error.fields.slice(0, 5).map((field, index) => (
              <li key={`${field.feature}-${index}`}>
                <span className="font-semibold">{field.feature}</span>: {field.message}
              </li>
            ))}
          </ul>
        ) : null}
        {onRetry ? (
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={onRetry}
            className="mt-3"
          >
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Empty state with an optional call to action. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/** Inline notice for non-blocking context (hints, caveats, warnings). */
export function Callout({ tone = 'info', title, children, icon, className }) {
  const tones = {
    info: {
      wrap: 'border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200',
      icon: 'text-sky-500',
      Default: Info,
    },
    warning: {
      wrap: 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
      icon: 'text-amber-500',
      Default: TriangleAlert,
    },
    success: {
      wrap: 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
      icon: 'text-emerald-500',
      Default: CircleCheck,
    },
    danger: {
      wrap: 'border-red-200 bg-red-50/70 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200',
      icon: 'text-red-500',
      Default: CircleX,
    },
  }[tone]

  const Icon = icon ?? tones.Default

  return (
    <div className={cn('flex gap-3 rounded-xl border p-3.5 text-xs leading-relaxed', tones.wrap, className)}>
      <Icon className={cn('mt-px size-4 shrink-0', tones.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 font-bold">{title}</p> : null}
        <div className={title ? 'opacity-90' : ''}>{children}</div>
      </div>
    </div>
  )
}

/**
 * Picks the right state component for an async resource.
 * Keeps every page's loading/error/empty handling identical.
 */
export function AsyncBoundary({
  loading,
  error,
  isEmpty,
  onRetry,
  loadingRows = 3,
  empty,
  children,
  compact = false,
}) {
  if (loading) return <LoadingState rows={loadingRows} />
  if (error) return <ErrorState error={error} onRetry={onRetry} compact={compact} />
  if (isEmpty) return empty ?? <EmptyState title="Nothing to show yet" />
  return children
}

// --------------------------------------------------------------- Metrics ----

/** Label / value / hint row used inside cards and detail panels. */
export function Metric({ label, value, hint, className, valueClassName }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 font-mono text-sm font-semibold break-words text-slate-900 dark:text-white',
          valueClassName,
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  )
}

/** Horizontal progress bar with an accessible value. */
export function ProgressBar({ value, max = 100, color, className, height = 'h-2', label }) {
  const pct = Number.isFinite(Number(value)) ? Math.min(Math.max(Number(value), 0), max) : 0
  const width = max === 0 ? 0 : (pct / max) * 100

  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', height, className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color ?? 'var(--color-brand-500)' }}
      />
    </div>
  )
}

/** Small status dot used in nav items and inline legends. */
export function StatusDot({ color = 'currentColor', className, pulse = false }) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)}>
      {pulse ? (
        <span
          className="absolute inline-flex size-full animate-ping rounded-full opacity-70"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      ) : null}
      <span
        className="relative inline-flex size-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    </span>
  )
}

/** Segmented control, used for chart metric switches and history range filters. */
export function SegmentedControl({ options, value, onChange, size = 'md', className }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {option.icon ? <option.icon className="size-3.5" aria-hidden="true" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Definition-list wrapper so key/value pairs align consistently. */
export function MetricGrid({ children, cols = 2, className }) {
  const gridCols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols]
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', gridCols, className)}>{children}</dl>
  )
}

export { CircleAlert, CircleCheck, CircleX, Info, TriangleAlert }
