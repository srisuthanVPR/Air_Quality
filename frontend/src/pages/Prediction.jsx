/**
 * Single-reading prediction.
 *
 * The form is generated from `GET /api/model/features` rather than being
 * hard-coded, so the input names, ranges, units and step sizes can never drift
 * out of sync with the trained model. Partial input is allowed: anything left
 * blank is median-imputed by the backend and reported back in the result.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleAlert,
  Copy,
  Eraser,
  Info,
  Play,
  Sparkles,
  Wand2,
} from 'lucide-react'

import { AQStatusCard } from '../components/AQStatusCard.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import {
  AsyncBoundary,
  Button,
  Callout,
  Card,
  CardBody,
  EmptyState,
} from '../components/UI.jsx'
import { useApi, useCopyToClipboard } from '../hooks/useApi.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { getClasses, getModelFeatures, predict } from '../services/api.js'
import { cn } from '../utils/cn.js'
import { decimal } from '../utils/formatters.js'

/** Builds a readable payload from the API feature schema. */
function defaultsFrom(features = [], override = {}) {
  return features.reduce((accumulator, feature) => {
    accumulator[feature.name] = override[feature.name] ?? feature.placeholder ?? ''
    return accumulator
  }, {})
}

export default function Prediction() {
  useDocumentTitle('Predict')

  const schema = useApi(getModelFeatures, [])
  const classes = useApi(getClasses, [])

  const [values, setValues] = useState({})
  const [touched, setTouched] = useState({})
  const [result, setResult] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveToHistory, setSaveToHistory] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const { copied, copy } = useCopyToClipboard()

  const features = useMemo(() => schema.data?.features ?? [], [schema.data])
  const defaults = useMemo(() => defaultsFrom(features), [features])
  const excluded = schema.data?.excluded_columns ?? {}

  // Seed the form once the schema arrives, but never clobber user input.
  useEffect(() => {
    if (features.length) setValues((current) => (Object.keys(current).length ? current : defaults))
  }, [features, defaults])

  const providedCount = useMemo(
    () => Object.values(values).filter((value) => String(value ?? '').trim() !== '').length,
    [values],
  )
  const missingCount = features.length - providedCount
  const canSubmit = features.length > 0 && providedCount > 0 && !submitting

  const setValue = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setTouched((current) => ({ ...current, [name]: true }))
  }, [])

  const reset = useCallback(() => {
    setValues(defaults)
    setTouched({})
    setResult(null)
    setSubmitError(null)
  }, [defaults])

  const submit = async (event) => {
    event?.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Drop blanks so the backend can median-impute them instead of
      // receiving empty strings it would have to reject.
      const payload = Object.fromEntries(
        Object.entries(values)
          .filter(([, value]) => String(value ?? '').trim() !== '')
          .map(([key, value]) => [key, Number(value)]),
      )

      const response = await predict(payload, { save: saveToHistory })
      setResult(response)
    } catch (error) {
      setSubmitError(error)
      setResult(null)
    } finally {
      setSubmitting(false)
    }
  }

  const fillAll = () => {
    setValues(defaults)
    setTouched({})
  }

  const clearAll = () => {
    setValues(Object.fromEntries(features.map((feature) => [feature.name, ''])))
    setTouched({})
  }

  const visibleFeatures = showAll ? features : features.slice(0, 6)
  const classLegend = classes.data?.classes ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Predict air quality"
        description="Enter hourly sensor readings and get a class, a confidence and the reasoning behind it."
        icon={Sparkles}
        action={
          <>
            <Button variant="secondary" icon={Eraser} onClick={reset}>
              Reset to medians
            </Button>
          </>
        }
      />

      <AsyncBoundary loading={schema.loading} error={schema.error} onRetry={schema.refresh} loadingRows={4}>
        <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
          {/* ---------------------------------------------------- input panel */}
          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sensor readings</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {providedCount} of {features.length} provided
                    {missingCount > 0 ? ` · ${missingCount} will be median-imputed` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={fillAll}>
                    Fill all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearAll}>
                    Clear
                  </Button>
                </div>
              </div>

              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {visibleFeatures.map((feature) => (
                    <FeatureInput
                      key={feature.name}
                      feature={feature}
                      value={values[feature.name] ?? ''}
                      onChange={setValue}
                      showError={Boolean(touched[feature.name]) && !isValid(feature, values[feature.name])}
                    />
                  ))}
                </div>

                {features.length > 6 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAll((current) => !current)}
                    className="w-full"
                  >
                    {showAll ? 'Show fewer inputs' : `Show all ${features.length} inputs`}
                  </Button>
                ) : null}
              </CardBody>

              <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={saveToHistory}
                    onChange={(event) => setSaveToHistory(event.target.checked)}
                    className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-800"
                  />
                  Save to prediction history
                </label>

                <div className="flex items-center gap-2">
                  <Button variant="primary" type="submit" icon={Play} loading={submitting} disabled={!canSubmit}>
                    {submitting ? 'Predicting…' : 'Predict'}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Class legend */}
            {classLegend.length ? (
              <Card>
                <div className="px-5 pt-4 pb-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">What the classes mean</h2>
                </div>
                <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {classLegend.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {item.label}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">class {item.id}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {Object.keys(excluded).length ? (
              <Callout tone="info" icon={Info} title="Columns deliberately not used">
                <ul className="mt-1 space-y-1">
                  {Object.entries(excluded).map(([name, reason]) => (
                    <li key={name}>
                      <span className="font-mono font-semibold">{name}</span> — {reason}
                    </li>
                  ))}
                </ul>
              </Callout>
            ) : null}
          </div>

          {/* --------------------------------------------------- result panel */}
          <div className="flex flex-col gap-4">
            {submitError ? (
              <Callout tone="danger" icon={CircleAlert} title="That prediction could not be made">
                <p>{submitError.message}</p>
                {submitError.hint ? <p className="mt-1 opacity-80">{submitError.hint}</p> : null}
                {Array.isArray(submitError.fields) && submitError.fields.length ? (
                  <ul className="mt-2 space-y-0.5">
                    {submitError.fields.map((field, index) => (
                      <li key={`${field.feature}-${index}`} className="font-mono text-[11px]">
                        {field.feature}: {field.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Callout>
            ) : null}

            {result ? (
              <>
                <AQStatusCard result={result} features={features} />
                <PayloadCard result={result} copied={copied} onCopy={copy} />
              </>
            ) : submitError ? null : (
              <Card className="flex flex-col">
                <EmptyState
                  icon={Wand2}
                  title="No prediction yet"
                  description="Fill in the readings on the left and press Predict. Every value is optional — anything left blank is replaced with the training median and flagged in the result."
                >
                  <p className="mt-4 max-w-xs text-[11px] text-slate-400">
                    Tip: leave a field blank to see median imputation in action.
                  </p>
                </EmptyState>
              </Card>
            )}
          </div>
        </form>
      </AsyncBoundary>
    </div>
  )
}

/** Client-side mirror of the backend's range check, for inline feedback only. */
function isValid(feature, value) {
  const text = String(value ?? '').trim()
  if (text === '') return true // blank is legal; it gets imputed
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) return false
  return parsed >= feature.min && parsed <= feature.max
}

function FeatureInput({ feature, value, onChange, showError }) {
  const isBlank = String(value ?? '').trim() === ''
  const observed = feature.observed_min != null && feature.observed_max != null
    ? `${decimal(feature.observed_min, 1)}–${decimal(feature.observed_max, 1)}`
    : null

  return (
    <div className="min-w-0">
      <label
        htmlFor={`feature-${feature.name}`}
        className="field-label mb-1.5 justify-between"
        title={feature.tooltip}
      >
        <span className="truncate">{feature.label}</span>
        {isBlank ? (
          <span className="shrink-0 text-[10px] font-medium tracking-normal text-slate-400 normal-case">
            optional
          </span>
        ) : null}
      </label>

      <div className="relative">
        <input
          id={`feature-${feature.name}`}
          type="number"
          inputMode="decimal"
          step={feature.step ?? 'any'}
          value={value}
          onChange={(event) => onChange(feature.name, event.target.value)}
          placeholder={feature.placeholder ?? ''}
          className={cn('field pr-12 font-mono', showError && 'field-error')}
          aria-describedby={`hint-${feature.name}`}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {feature.unit}
        </span>
      </div>

      <p
        id={`hint-${feature.name}`}
        className={cn(
          'mt-1 truncate text-[10px]',
          showError ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500',
        )}
      >
{showError
        ? `Enter ${feature.min}–${feature.max} ${feature.unit}`
        : observed
          ? `Dataset range ${observed} ${feature.unit}`
          : feature.name}
      </p>
    </div>
  )
}

/** Shows exactly what was sent to the API, for reproducibility. */
function PayloadCard({ result, copied, onCopy }) {
  const inputs = result?.inputs ?? result?.input ?? null
  const serialised = inputs ? JSON.stringify(inputs, null, 2) : ''

  if (!serialised) return null

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Request payload</h2>
        <Button size="sm" variant="ghost" icon={Copy} onClick={() => onCopy(serialised)}>
          {copied ? 'Copied' : 'Copy JSON'}
        </Button>
      </div>
      <pre className="scroll-fade-x max-h-64 overflow-auto px-5 py-4 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
        {serialised}
      </pre>
    </Card>
  )
}

