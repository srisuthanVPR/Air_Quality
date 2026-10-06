/**
 * Public landing page.
 *
 * Goal: explain what the project is, show real numbers pulled from the API, and
 * get the visitor to `/dashboard`. Anything numeric here is fetched from the
 * backend so the marketing copy can never drift from the trained model.
 */
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CircleCheck,
  CircleDot,
  FileSpreadsheet,
  Gauge,
  Layers,
  LineChart,
  ServerCrash,
  Sparkles,
  Table2,
  Upload,
  Workflow,
} from 'lucide-react'

import { Button, Callout, Card } from '../components/UI.jsx'
import { useApi } from '../hooks/useApi.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { getDashboard } from '../services/api.js'
import { cn } from '../utils/cn.js'
import { classMeta } from '../utils/aqi.js'
import { number, percent } from '../utils/formatters.js'

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: 'Single-reading prediction',
    body: 'Twelve sensor values in, a calibrated class and confidence out — with the exact per-feature contributions behind the call.',
    to: '/predict',
    cta: 'Try a prediction',
  },
  {
    icon: Upload,
    title: 'Batch CSV scoring',
    body: 'Upload an hour of readings or a full day. Every row is scored in one pass and handed back as a downloadable CSV.',
    to: '/batch',
    cta: 'Upload a CSV',
  },
  {
    icon: Table2,
    title: 'Dataset explorer',
    body: 'Every one of the 9,471 readings, searchable, sortable and filterable, with the same cleaning pipeline the model saw.',
    to: '/dataset',
    cta: 'Browse the data',
  },
  {
    icon: LineChart,
    title: 'Analytics & trends',
    body: 'Hour-of-day profiles, pollutant correlations and class distributions, all computed from the real dataset.',
    to: '/analytics',
    cta: 'Explore analytics',
  },
  {
    icon: Layers,
    title: 'Honest evaluation',
    body: 'Per-class precision and recall, a confusion matrix, feature importances and four baselines scored on the same held-out split.',
    to: '/model',
    cta: 'See the metrics',
  },
  {
    icon: FileSpreadsheet,
    title: 'Prediction history',
    body: 'Every call is persisted locally so you can search, compare and export what the model has told you.',
    to: '/history',
    cta: 'View history',
  },
]

const PIPELINE = [
  { label: 'Raw sensors', detail: '5 metal-oxide sensors + reference instruments' },
  { label: 'Clean', detail: 'drop blanks & -200 sentinel rows' },
  { label: 'Impute', detail: 'median per feature' },
  { label: 'Scale', detail: 'StandardScaler' },
  { label: 'Predict', detail: 'RandomForestClassifier' },
]

export default function Landing() {
  useDocumentTitle('Machine learning air quality analysis')

  const { data, error, loading } = useApi(getDashboard, [])
  const kpis = data?.kpis ?? {}
  const model = data?.model ?? {}
  const distribution = data?.dataset?.class_distribution

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.6) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <span className="badge bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm">
                <CircleDot className="size-3" aria-hidden="true" />
                UCI Air Quality dataset · Random Forest classifier
              </span>

              <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Air quality,
                <br />
                <span className="text-brand-200">measured not asserted.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-50/85 sm:text-lg">
                Twelve sensor readings go in. A calibrated air quality class, a confidence score and
                the reasoning behind it come out — trained on 9,471 real hourly readings and
                evaluated against four honest baselines.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/dashboard">
                  <Button variant="primary" icon={Gauge} className="px-5 py-3 text-base">
                    Open the dashboard
                  </Button>
                </Link>
                <Link to="/predict">
                  <Button
                    className="border border-white/30 bg-white/10 px-5 py-3 text-base text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/20 hover:text-white"
                    icon={Sparkles}
                  >
                    Predict air quality
                  </Button>
                </Link>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/20 pt-7">
                <HeroStat label="Readings" value={number(kpis.total_records)} loading={loading} />
                <HeroStat label="Clean rows" value={number(kpis.training_records)} loading={loading} />
                <HeroStat
                  label="Test accuracy"
                  value={percent(model.accuracy)}
                  loading={loading}
                  accent
                />
              </dl>
            </div>

            {/* Live class distribution */}
            <div className="relative">
              <Card className="border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-xl dark:bg-white/8">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">Training class balance</p>
                  {loading ? <span className="spinner text-white/70" aria-hidden="true" /> : null}
                </div>

                {error ? (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/15 p-3 text-xs text-red-100">
                    <ServerCrash className="mt-px size-4 shrink-0" aria-hidden="true" />
                    Start the backend to see the live class balance. The rest of this page still works.
                  </p>
                ) : (
                  <>
                    <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/15">
                      {distribution &&
                        Object.entries(distribution.counts ?? {}).map(([label, value]) => (
                          <span
                            key={label}
                            className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
                            style={{
                              width: `${distribution.percentages?.[label] ?? 0}%`,
                              backgroundColor: distribution.colors?.[label] ?? classMeta(label).color,
                            }}
                            title={`${label}: ${value} rows (${distribution.percentages?.[label]}%)`}
                          />
                        ))}
                    </div>

                    <ul className="mt-4 space-y-2.5">
                      {distribution &&
                        Object.entries(distribution.counts ?? {}).map(([label, value]) => (
                          <li key={label} className="flex items-center gap-2.5 text-xs">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: distribution.colors?.[label] }}
                              aria-hidden="true"
                            />
                            <span className="flex-1 text-brand-50/90">{label}</span>
                            <span className="font-mono font-bold text-white">{number(value)}</span>
                            <span className="w-12 text-right font-mono text-brand-200/80">
                              {distribution.percentages?.[label]}%
                            </span>
                          </li>
                        ))}
                    </ul>
                  </>
                )}

                <p className="mt-5 border-t border-white/15 pt-4 text-[11px] leading-relaxed text-brand-100/70">
                  Class labels are derived from CO, NOx and NO2 thresholds — the same three columns
                  the model reads. <span className="font-semibold text-brand-50">See the
                  methodology</span> before reading the headline accuracy.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ capabilities */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Everything an ML demo usually hides
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Six connected surfaces over one model: live inference, bulk scoring, the raw dataset,
            exploratory analysis, a full evaluation report and an auditable prediction log.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <Card key={item.title} hover className="group flex flex-col p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110 dark:bg-brand-500/12 dark:text-brand-400">
                <item.icon className="size-5" aria-hidden="true" />
              </span>

              <h3 className="mt-4 text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {item.body}
              </p>

              <Link
                to={item.to}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {item.cta}
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- pipeline */}
      <section className="border-y border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-400">
                <Workflow className="size-3" aria-hidden="true" />
                End to end
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                From raw sensor to class label
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                The same preprocessing runs during training and at inference time, which is the part
                most demos get wrong — a model trained on one imputation strategy and served with
                another will quietly produce worse answers than its accuracy suggests.
              </p>

              <ul className="mt-6 space-y-2.5">
                {[
                  'Training medians are persisted and reused at inference',
                  'Missing cells are filled from those medians, never from zero',
                  'Out-of-range values are rejected instead of silently clamped',
                  'Every reported metric comes from a held-out split',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <CircleCheck
                      className="mt-px size-4 shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>

              <Link to="/about" className="mt-7 inline-block">
                <Button variant="secondary" icon={ArrowRight}>
                  Read the methodology
                </Button>
              </Link>
            </div>

            <Card className="p-5 sm:p-6">
              <ol className="space-y-1">
                {PIPELINE.map((step, index) => (
                  <li key={step.label} className="relative flex items-center gap-4 pb-5 last:pb-0">
                    {index < PIPELINE.length - 1 ? (
                      <span
                        className="absolute top-9 bottom-0 left-[17px] w-px bg-slate-200 dark:bg-slate-700"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className={cn(
                        'relative z-10 grid size-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-bold text-white',
                        index === PIPELINE.length - 1
                          ? 'bg-gradient-to-br from-brand-500 to-accent-500'
                          : 'bg-slate-300 dark:bg-slate-700',
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{step.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- honesty */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            One caveat, stated up front
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            A near-perfect score on this dataset is expected, and reading it as evidence of a
            hard-won model would be a mistake.
          </p>

          <div className="mt-8">
            <Callout tone="warning" title="The label is a function of the inputs">
              <p>
                Each class is derived by scoring CO(GT), NOx(GT) and NO2(GT) against fixed thresholds
                and summing the results. Those exact three columns are also model features, so a tree
                ensemble can recover the rule almost perfectly. That is a property of the
                benchmark, not a measure of generalisation.
              </p>
              <p className="mt-2">
                Treat the numbers on the Model Performance page as a demonstration that the training
                and serving pipelines agree — and read the methodology for what would need to change
                to make this a genuinely hard problem.
              </p>
            </Callout>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard">
              <Button variant="primary" icon={Gauge}>
                Start exploring
              </Button>
            </Link>
            <Link to="/model">
              <Button variant="secondary" icon={Layers}>
                See the real metrics
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

/** White-on-dark stat used inside the hero. */
function HeroStat({ label, value, loading, accent = false }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-[0.14em] text-brand-200/80 uppercase">{label}</dt>
      <dd
        className={cn(
          'mt-1 font-mono text-xl font-bold sm:text-2xl',
          accent ? 'text-brand-200' : 'text-white',
        )}
      >
        {loading ? <span className="inline-block h-6 w-16 rounded bg-white/20" /> : (value ?? '—')}
      </dd>
    </div>
  )
}
