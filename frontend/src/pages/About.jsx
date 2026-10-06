/**
 * About / methodology.
 *
 * This page exists because the headline accuracy needs context. It documents
 * the dataset, the exact labelling rule, what the model can and cannot do, and
 * the honest weaknesses — read from the artifacts rather than hard-coded, so it
 * cannot drift away from what was actually trained.
 */
import {
  BookOpen,
  CircleCheck,
  Database,
  FileWarning,
  GitBranch,
  Info,
  Layers3,
  Scale,
  TriangleAlert,
} from 'lucide-react'

import { PageHeader } from '../components/PageHeader.jsx'
import {
  AsyncBoundary,
  Badge,
  Callout,
  Card,
  CardBody,
  Metric,
  MetricGrid,
  NeutralBadge,
  ProgressBar,
} from '../components/UI.jsx'
import { WorkflowDiagram } from '../components/WorkflowDiagram.jsx'
import { useApi } from '../hooks/useApi.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { getDatasetSummary, getModelInfo, getModelMetrics, getModelWorkflow } from '../services/api.js'
import { CLASS_ORDER, classMeta } from '../utils/aqi.js'
import { number, percent, shortDateTime } from '../utils/formatters.js'

const LIMITATIONS = [
  {
    title: 'The label is derived from the inputs',
    body: 'Classes come from thresholding CO(GT), NOx(GT) and NO2(GT) — the same three columns the model reads. The model is therefore partly reproducing a published rule rather than discovering something new from the air.',
  },
  {
    title: 'One station, one year, one city',
    body: 'All 9,471 readings come from a single monitoring station in Italy across roughly 13 months. Nothing here generalises to another city, season or instrument without retraining.',
  },
  {
    title: 'No calibration',
    body: 'Probabilities come straight from a random forest vote distribution. They are not isotonic- or Platt-calibrated, so 98% confidence is not a calibrated statement that 98% of readings in this band will behave this way.',
  },
  {
    title: 'Random split, not temporal or spatial',
    body: 'The held-out split is random with a fixed seed, so neighbouring hours from the same day can land on both sides. A time-based split would be the stricter test and has not been run.',
  },
  {
    title: 'Missing values become medians',
    body: 'About 8% of cells are blank or the -200 disconnected-sensor sentinel. Those are replaced with the training median, which flattens peaks and can understate severity on affected days.',
  },
]

export default function About() {
  useDocumentTitle('About')

  const info = useApi(getModelInfo, [])
  const metrics = useApi(getModelMetrics, [])
  const workflow = useApi(getModelWorkflow, [])
  const dataset = useApi(getDatasetSummary, [])

  const data = metrics.data ?? {}
  const importances = Object.entries(data.feature_importances ?? {})
    .map(([feature, value]) => ({ feature, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
  const totalImportance = importances.reduce((sum, item) => sum + item.value, 0) || 1

  const workflowSteps = (workflow.data?.steps ?? []).map((title, index) => ({
    title,
    body: workflow.data?.details?.[index]?.body,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="About this project"
        description="What the system does, how the label is produced, and where the numbers stop being trustworthy."
        icon={BookOpen}
      />

      <AsyncBoundary
        loading={info.loading || metrics.loading}
        error={info.error ?? metrics.error}
        onRetry={() => {
          info.refresh()
          metrics.refresh()
        }}
        loadingRows={4}
      >
        <div className="flex flex-col gap-6">
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {info.data?.name ?? 'Air Quality Classifier'}
                    </h2>
                    <Badge dot color={data.model_status?.ready ? '#10b981' : '#f59e0b'}>
                      {data.model_status?.ready ? 'Model ready' : 'Model missing'}
                    </Badge>
                    {info.data?.problem_type ? (
                      <NeutralBadge>{info.data.problem_type}</NeutralBadge>
                    ) : null}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {info.data?.description}
                  </p>
                </div>
              </div>

              <MetricGrid cols={4} className="mt-5">
                <Metric label="Algorithm" value={data.algorithm_label ?? data.algorithm} />
                <Metric label="Features" value={number(data.n_features ?? 12)} />
                <Metric
                  label="Accuracy"
                  value={percent(data.accuracy)}
                  hint={`on ${number(data.split?.test_samples)} held-out rows`}
                />
                <Metric
                  label="Trained"
                  value={shortDateTime(data.model_status?.trained_at)}
                  hint={`scikit-learn ${data.environment?.sklearn ?? '—'}`}
                />
              </MetricGrid>
            </CardBody>
          </Card>

          {/* ------------------------------------------------ dataset section */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Database className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  The dataset
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  The UCI Air Quality dataset: hourly readings from a fixed station in Italy, with five
                  metal-oxide (PT08) sensors, reference instruments for CO, benzene, NOx and NO2, plus
                  temperature, relative humidity and absolute humidity.
                </p>

                <MetricGrid cols={3} className="mt-4">
                  <Metric label="Rows" value={number(dataset.data?.total_rows)} />
                  <Metric
                    label="Usable rows"
                    value={number(dataset.data?.valid_rows)}
                    hint={`${percent(
                      (dataset.data?.valid_rows ?? 0) / Math.max(dataset.data?.total_rows ?? 1, 1),
                      1,
                    )}`}
                  />
                  <Metric
                    label="Missing cells"
                    value={number(dataset.data?.missing_values)}
                    hint="before imputation"
                  />
                </MetricGrid>

                <MetricGrid cols={2} className="mt-4">
                  <Metric label="First reading" value={String(dataset.data?.date_range?.start ?? '—').slice(0, 10)} />
                  <Metric label="Last reading" value={String(dataset.data?.date_range?.end ?? '—').slice(0, 10)} />
                </MetricGrid>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Layers3 className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  How the label is produced
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  There is no measured &ldquo;air quality class&rdquo; in the dataset. Each row is scored
                  from three pollutant columns and banded:
                </p>

                <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="font-mono text-[11px] leading-relaxed break-words text-slate-700 dark:text-slate-200">
                    {workflow.data?.target_rule}
                  </p>
                </div>

                <ul className="mt-4 space-y-2">
                  {CLASS_ORDER.map((label) => {
                    const share = data.class_distribution?.[label]
                    const meta = classMeta(label)
                    return (
                      <li key={label}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <span
                              className={`size-2 rounded-full ${meta.dot}`}
                              aria-hidden="true"
                            />
                            {label}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {number(share)} rows
                          </span>
                        </div>
                        <ProgressBar
                          value={share ?? 0}
                          max={Math.max(...Object.values(data.class_distribution ?? {}), 1)}
                          color={meta.color}
                          height="h-1.5"
                          label={`${label} row share`}
                        />
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* --------------------------------------------- features + baselines */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <GitBranch className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  Top features
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Share of total impurity-based importance
                </p>
                <ul className="mt-4 space-y-2.5">
                  {importances.map((item) => (
                    <li key={item.feature}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {item.feature}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {percent(item.value / totalImportance, 1)}
                        </span>
                      </div>
                      <ProgressBar
                        value={item.value}
                        max={totalImportance}
                        height="h-1.5"
                        label={`${item.feature} importance`}
                      />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Scale className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  Baselines
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Scored on the same held-out split
                </p>
                <ul className="mt-4 space-y-2">
                  {(data.model_comparison ?? []).map((row) => (
                    <li
                      key={row.name}
                      className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 text-xs last:border-0 dark:border-slate-800"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
                        <span className="truncate">{row.name}</span>
                        {row.is_primary ? (
                          <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300">
                            primary
                          </Badge>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono font-bold text-slate-700 dark:text-slate-200">
                        {percent(row.accuracy)} · F1 {percent(row.f1_score)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* -------------------------------------------------- limitations */}
          <Card>
            <CardBody>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <TriangleAlert className="size-4 text-amber-500" aria-hidden="true" />
                Limitations worth stating out loud
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {LIMITATIONS.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800"
                  >
                    <p className="flex items-start gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                      <FileWarning className="mt-px size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <WorkflowDiagram
            steps={workflowSteps}
            targetRule={workflow.data?.target_rule}
            featureGroups={workflow.data?.feature_groups ?? []}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Callout tone="success" icon={CircleCheck} title="What it is good for">
              <ul className="mt-1 space-y-1">
                <li>Explaining how pollutant thresholds map onto an air-quality band.</li>
                <li>Scoring large historical CSV exports consistently with the training pipeline.</li>
                <li>Demonstrating a complete, reproducible training and serving path on real data.</li>
              </ul>
            </Callout>

            <Callout tone="warning" icon={Info} title="What it is not">
              <ul className="mt-1 space-y-1">
                <li>A public health tool — nothing here is validated for advice to individuals.</li>
                <li>A forecast: every prediction scores a reading you supply, not the next hour.</li>
                <li>A geographically transferable model; it only knows this one station.</li>
              </ul>
            </Callout>
          </div>
        </div>
      </AsyncBoundary>
    </div>
  )
}
