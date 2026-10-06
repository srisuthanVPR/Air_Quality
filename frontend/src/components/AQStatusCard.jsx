/**
 * The prediction verdict card.
 *
 * Renders exactly what `POST /api/predict` returns:
 *   prediction, label, confidence, all_probabilities, contributions,
 *   outliers, imputed, inputs.
 *
 * One caveat is surfaced prominently rather than buried: the label is derived
 * from CO(GT)/NOx(GT)/NO2(GT), which are also model inputs, so a high
 * confidence is expected by construction and is not evidence of a hard problem.
 */
import { CircleAlert, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '../utils/cn.js'
import { classMeta } from '../utils/aqi.js'
import { decimal, number, percent } from '../utils/formatters.js'
import { Callout, Card, NeutralBadge, ProgressBar } from './UI.jsx'

export function AQStatusCard({ result, features = [], className }) {
  if (!result) return null

  const label = result.label ?? result.status ?? 'Unknown'
  const classId = result.prediction ?? classMeta(label).id
  const confidence = Number(result.confidence ?? 0)
  const meta = classMeta(label)

  // The API returns percentages (0-100); normalise defensively.
  const probabilities = result.all_probabilities ?? {}
  const probabilityEntries = Object.entries(probabilities)

  const contributions = Array.isArray(result.contributions) ? result.contributions : []
  const imputed = Array.isArray(result.imputed) ? result.imputed : []
  const outliers = Array.isArray(result.outliers) ? result.outliers : []

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card className="relative overflow-hidden">
        {/* Status wash */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: `linear-gradient(135deg, ${meta.color}, transparent 65%)` }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div
            className="relative grid size-24 shrink-0 place-items-center rounded-3xl text-white shadow-lift"
            style={{ backgroundImage: `linear-gradient(140deg, ${meta.color}, ${meta.color}cc)` }}
            aria-hidden="true"
          >
            <span className="text-center">
              <span className="block font-mono text-2xl font-extrabold">{Math.round(confidence)}</span>
              <span className="block text-[10px] font-bold tracking-widest opacity-85">% CONF</span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
              Predicted air quality
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {label}
            </h2>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className={cn('badge', meta.badge)}>
                <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
                Class {classId}
              </span>
              <NeutralBadge>{meta.audience}</NeutralBadge>
              {outliers.length ? (
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  {outliers.length} outlier{outliers.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {result.recommendation}
            </p>
          </div>
        </div>

        {probabilityEntries.length ? (
          <div className="relative border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
            <p className="mb-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Class probabilities
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {probabilityEntries.map(([name, raw]) => {
                const numeric = Number(raw) || 0
                const share = numeric > 1 ? numeric / 100 : numeric
                const isWinner = name === label

                return (
                  <div key={name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-semibold',
                          isWinner ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400',
                        )}
                      >
                        <span
                          className={cn('size-1.5 rounded-full', classMeta(name).dot)}
                          aria-hidden="true"
                        />
                        {name}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                        {percent(share, 1)}
                      </span>
                    </div>
                    <ProgressBar
                      value={share}
                      max={1}
                      color={classMeta(name).color}
                      height="h-1.5"
                      label={`${name} probability`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </Card>

      {imputed.length ? (
        <Callout
          tone="warning"
          title={`${imputed.length} value${imputed.length === 1 ? '' : 's'} filled with the training median`}
        >
          <ul className="mt-1 space-y-0.5">
            {imputed.map((item) => (
              <li key={item.feature}>
                <span className="font-semibold">{item.label}</span> ({item.feature}) was not provided, so{' '}
                {decimal(item.median_used, 2)} {item.unit} was substituted.
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {outliers.length ? (
        <Callout tone="warning" title="Values far outside the training average">
          <ul className="mt-1 space-y-0.5">
            {outliers.map((item) => (
              <li key={item.feature}>
                <span className="font-semibold">{item.label}</span>: {decimal(item.value, 2)} versus a
                training average of {decimal(item.dataset_average, 2)}.
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ContributionsPanel items={contributions} />
        <RangesPanel inputs={result.inputs ?? {}} features={features} />
      </div>

      <Callout tone="info" icon={CircleAlert} title="How to read this confidence">
        The label is derived from CO(GT), NOx(GT) and NO2(GT) thresholds, and those three columns are
        also model inputs. Near-100% confidence is therefore expected by construction — treat it as
        &ldquo;the sensors clearly indicate this band&rdquo;, not as proof the model is well calibrated
        on unseen air.
      </Callout>
    </div>
  )
}

/** Signed per-feature contribution estimate, strongest influence first. */
function ContributionsPanel({ items }) {
  if (!items.length) return null

  const top = items.slice(0, 6)

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-2.5 px-5 pt-4 pb-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-400">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top feature contributions</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Directional estimate of how far each reading sat from the class boundary.
          </p>
        </div>
      </div>

      <ul className="flex-1 space-y-2.5 px-5 pb-4">
        {top.map((item) => {
          const worse = item.pushed_toward === 'worse'
          const Icon = worse ? TrendingUp : TrendingDown

          return (
            <li key={item.feature}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <Icon
                    className={cn('size-3.5 shrink-0', worse ? 'text-orange-500' : 'text-sky-500')}
                    aria-hidden="true"
                  />
                  <span className="truncate" title={item.label}>
                    {item.label}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {percent(item.influence, 1)}
                </span>
              </div>
              <ProgressBar
                value={item.influence}
                max={Math.max(...top.map((entry) => Number(entry.influence) || 0), 1)}
                color={worse ? '#f97316' : '#0ea5e9'}
                height="h-1.5"
                label={`${item.label} influence`}
              />
              <p className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                entered {decimal(item.value, 2)}
                {item.unit ? ` ${item.unit}` : ''} · avg {decimal(item.dataset_average, 2)} · z{' '}
                {decimal(item.z_score, 2)}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="border-t border-slate-200/80 px-5 py-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Orange pushed the reading toward a worse class, blue toward a better one. Influence is the
        share of total movement; these are heuristic estimates derived from training mean and spread,
        not exact Shapley values.
      </p>
    </Card>
  )
}

/** Where each entered value sat inside the accepted and observed ranges. */
function RangesPanel({ inputs, features }) {
  if (!features.length) return null

  const byName = new Map(features.map((feature) => [feature.name, feature]))
  const rows = Object.entries(inputs).filter(([, value]) => Number.isFinite(Number(value)))

  if (!rows.length) return null

  return (
    <Card className="flex flex-col">
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Input vs training range</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Where this reading sits between the observed minimum and maximum in the dataset.
        </p>
      </div>

      <ul className="flex-1 space-y-3 px-5 pb-4">
        {rows.map(([name, rawValue]) => {
          const feature = byName.get(name)
          const value = Number(rawValue)
          const low = Number(feature?.observed_min)
          const high = Number(feature?.observed_max)
          const usable = Number.isFinite(low) && Number.isFinite(high) && high > low
          const span = high - low
          const position = usable ? ((value - low) / span) * 100 : 0
          const clamped = Math.min(Math.max(position, 0), 100)
          const beyondObserved = usable && (position < 0 || position > 100)

          return (
            <li key={name}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span
                  className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
                  title={feature?.label ?? name}
                >
                  {feature?.label ?? name}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {decimal(value, 2)}
                  {usable ? (
                    <span className="ml-1 font-normal text-slate-400">
                      ({number(low, 0)}–{number(high, 0)})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="absolute inset-y-0 w-1 rounded-full transition-[left] duration-500"
                  style={{
                    left: `calc(${clamped}% - 2px)`,
                    backgroundColor: beyondObserved ? '#f59e0b' : 'var(--color-brand-500)',
                  }}
                  aria-hidden="true"
                />
              </div>
              {beyondObserved ? (
                <p className="mt-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Outside the range seen in training
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
