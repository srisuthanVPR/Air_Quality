/**
 * Model performance.
 *
 * Everything here comes from persisted training artifacts, not from anything
 * computed at request time: `/api/model/metrics` is the metrics file written by
 * `python -m backend.ml.train`.
 *
 * The page deliberately shows the Decision Tree beating the Random Forest and a
 * note explaining why the headline accuracy should not be quoted without that
 * context — an evaluation page that only flatters the model is marketing.
 */
import { useMemo } from 'react'
import {
  Brain,
  Cpu,
  FileWarning,
  Gauge,
  ListTree,
  Scale,
  Sigma,
  Target,
  Timer,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '../components/PageHeader.jsx'
import { StatCard } from '../components/StatCard.jsx'
import { ChartCard, ChartTooltip } from '../components/charts/ChartCard.jsx'
import { ConfusionMatrix } from '../components/charts/ConfusionMatrix.jsx'
import { useChartAnimation, useChartTheme } from '../components/charts/chartTheme.jsx'
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
import { getModelInfo, getModelMetrics, getModelWorkflow } from '../services/api.js'
import { classMeta } from '../utils/aqi.js'
import { cn } from '../utils/cn.js'
import { number, percent, shortDateTime } from '../utils/formatters.js'

const METRIC_KEYS = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1_score', label: 'F1 (weighted)' },
]

export default function ModelPerformance() {
  useDocumentTitle('Model')
  const metrics = useApi(getModelMetrics, [])
  const info = useApi(getModelInfo, [])
  const workflow = useApi(getModelWorkflow, [])

  const data = metrics.data ?? {}
  const theme = useChartTheme()
  const anim = useChartAnimation()

  const perClass = data.per_class ?? []
  const comparison = useMemo(() => metrics.data?.model_comparison ?? [], [metrics.data])
  const importances = useMemo(
    () =>
      Object.entries(data.feature_importances ?? {})
        .map(([feature, value]) => ({ feature, value: Number(value) || 0 }))
        .sort((a, b) => b.value - a.value),
    [data.feature_importances],
  )

  const primary = comparison.find((row) => row.is_primary) ?? null
  const best = comparison.reduce(
    (champion, row) => (champion === null || row.accuracy > champion.accuracy ? row : champion),
    null,
  )
  const beatsDummy = useMemo(() => {
    const dummy = comparison.find((row) => /dummy|majority/i.test(row.name))
    if (!primary || !dummy) return null
    return primary.accuracy - dummy.accuracy
  }, [primary, comparison])

  const importanceTotal = importances.reduce((sum, item) => sum + item.value, 0) || 1

  // `/api/model/workflow` sends parallel arrays: step titles and detail blocks.
  const workflowSteps = useMemo(() => {
    const steps = workflow.data?.steps ?? []
    const details = workflow.data?.details ?? []
    return steps.map((title, index) => ({
      title,
      body: details[index]?.body,
    }))
  }, [workflow.data])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Model performance"
        description="Held-out metrics, per-class behaviour, feature importance and the baselines the model was measured against."
        icon={Brain}
        action={
          data.model_status?.trained_at ? (
            <NeutralBadge>Trained {shortDateTime(data.model_status.trained_at)}</NeutralBadge>
          ) : null
        }
      />

      <AsyncBoundary
        loading={metrics.loading}
        error={metrics.error}
        onRetry={metrics.refresh}
        loadingRows={5}
      >
        <div className="flex flex-col gap-6">
          {/* ------------------------------------------------------- headline */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {METRIC_KEYS.map((metric) => (
              <StatCard
                key={metric.key}
                label={metric.label}
                value={percent(data[metric.key])}
                icon={metric.key === 'accuracy' ? Target : Sigma}
                tone={metric.key === 'accuracy' ? 'emerald' : 'brand'}
                hint={data.averaging ? `${data.averaging} averaging` : undefined}
              />
            ))}
          </div>

          {!data.model_status?.ready ? (
            <Callout tone="danger" icon={FileWarning} title="No trained model found">
              The metrics file is missing or unreadable. Train the model with{' '}
              <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-[11px] dark:bg-red-500/20">
                python -m backend.ml.train
              </code>{' '}
              and reload this page.
            </Callout>
          ) : null}

          {/* ---------------------------------------------------- comparison */}
          <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <ChartCard
              title="Model comparison"
              subtitle="Every classifier scored on the same held-out split, using identical preprocessing."
              icon={Scale}
              height={260}
              isEmpty={!comparison.length}
              footer={
                <>
                  A single Decision Tree edges out the ensemble on this dataset. That is expected when
                  the label is a threshold function of three inputs: one deep tree can memorise the
                  boundary, while a forest averages many noisier boundary estimates.
                </>
              }
            >
              <BarChart
                data={comparison.map((row) => ({
                  name: row.name,
                  accuracy: row.accuracy,
                  f1: row.f1_score,
                  primary: row.is_primary,
                }))}
                margin={{ top: 18, right: 12, bottom: 4, left: 0 }}
              >
                <CartesianGrid {...theme.gridProps} vertical={false} />
                <XAxis
                  dataKey="name"
                  {...theme.xAxisProps}
                  interval={0}
                  height={52}
                  angle={-18}
                  textAnchor="end"
                />
                <YAxis
                  {...theme.yAxisProps}
                  domain={[0, 1]}
                  tickFormatter={(value) => `${Math.round(value * 100)}%`}
                />
                <Tooltip
                  cursor={{ fill: 'currentColor', fillOpacity: 0.04 }}
                  content={
                    <ChartTooltip
                      valueFormatter={(value, entry) =>
                        entry.dataKey === 'accuracy'
                          ? `accuracy ${percent(value)}`
                          : `F1 ${percent(value)}`
                      }
                    />
                  }
                />
                <Bar dataKey="accuracy" name="Accuracy" radius={[4, 4, 0, 0]} {...anim}>
                  {comparison.map((row) => (
                    <Cell
                      key={row.name}
                      fill={row.is_primary ? '#0d9488' : '#94a3b8'}
                      fillOpacity={row.is_primary ? 1 : 0.55}
                    />
                  ))}
                  <LabelList
                    dataKey="accuracy"
                    position="top"
                    formatter={(value) => percent(value, 1)}
                    className="fill-slate-500 text-[10px] dark:fill-slate-400"
                  />
                </Bar>
              </BarChart>
            </ChartCard>

            <Card className="flex flex-col">
              <CardBody className="flex-1">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Cpu className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  The primary model
                </h2>

                <MetricGrid cols={2} className="mt-4">
                  <Metric
                    label="Algorithm"
                    value={data.algorithm_label ?? data.algorithm}
                    className="col-span-2"
                  />
                  <Metric label="Problem" value={data.problem_type} className="col-span-2" />
                  <Metric label="Training rows" value={number(data.split?.train_samples)} />
                  <Metric label="Test rows" value={number(data.split?.test_samples)} />
                  <Metric
                    label="Test fraction"
                    value={percent(data.split?.test_size, 0)}
                    hint={`Random state ${data.split?.random_state ?? '—'}`}
                  />
                  <Metric
                    label="Stratified"
                    value={data.split?.stratified ? 'Yes' : 'No'}
                    hint="Keeps class balance identical in both splits"
                  />
                </MetricGrid>

                <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-800">
                  <p className="field-label mb-2">Hyper-parameters</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {Object.entries(data.params ?? {}).map(([key, value]) => (
                      <li key={key}>
                        <span className="badge bg-slate-100 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {key}={String(value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {beatsDummy !== null ? (
                  <Callout tone="success" className="mt-4">
                    The model beats the majority-class baseline by{' '}
                    <span className="font-bold">{percent(beatsDummy, 1)}</span> of accuracy — so it is
                    genuinely using the sensor readings, not just guessing the most common class.
                  </Callout>
                ) : null}
              </CardBody>

              {best && primary && best.accuracy > primary.accuracy ? (
                <div className="border-t border-slate-200/80 px-5 py-3 dark:border-slate-800">
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Highest accuracy here: <span className="font-semibold">{best.name}</span> at{' '}
                    {percent(best.accuracy)}. The Random Forest is kept as the primary model for its
                    more stable behaviour across classes and seeds, not for the top headline number.
                  </p>
                </div>
              ) : null}
            </Card>
          </div>

          {/* -------------------------------------------- per-class + matrix */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <ListTree className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  Per-class scores
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Precision, recall and F1 for each band, with held-out support.
                </p>

                <ul className="mt-4 space-y-4">
                  {perClass.map((row) => {
                    const meta = classMeta(row.label)
                    return (
                      <li key={row.class_id ?? row.label}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                            <span
                              className={cn('size-2.5 rounded-full', meta.dot)}
                              aria-hidden="true"
                            />
                            {row.label}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {number(row.support)} held out
                          </span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          {[
                            ['Precision', row.precision],
                            ['Recall', row.recall],
                            ['F1', row.f1_score],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <div className="mb-1 flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                  {label}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                  {percent(value, 1)}
                                </span>
                              </div>
                              <ProgressBar
                                value={value}
                                max={1}
                                color={meta.color}
                                height="h-1.5"
                                label={`${row.label} ${label}`}
                              />
                            </div>
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>

            <ConfusionMatrix
              labels={data.confusion_labels ?? []}
              matrix={data.confusion_matrix ?? []}
              subtitle="Counts of held-out readings: rows are the true band, columns the predicted band."
            />
          </div>

          <ConfusionMatrix
            labels={data.confusion_labels ?? []}
            matrix={data.confusion_matrix_normalized ?? []}
            normalized
            title="Confusion matrix (row-normalised)"
            subtitle="Each row sums to 100%, so a short row means the model rarely confused that band."
          />

          {/* ---------------------------------------------------- importance */}
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <ChartCard
              title="Feature importance"
              subtitle="Mean decrease in impurity across the forest, as a share of total."
              icon={Gauge}
              height={Math.max(280, importances.length * 30)}
              isEmpty={!importances.length}
              footer={
                <>
                  Importance shows how much the model relied on a column to split data — it is not a
                  causal effect, and correlated sensors share credit between them.
                </>
              }
            >
              <BarChart
                data={importances}
                layout="vertical"
                margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
              >
                <CartesianGrid {...theme.gridProps} horizontal={false} />
                <XAxis
                  type="number"
                  {...theme.xAxisProps}
                  tickFormatter={(value) => percent(value, 0)}
                />
                <YAxis
                  type="category"
                  dataKey="feature"
                  {...theme.yAxisProps}
                  width={110}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ fill: 'currentColor', fillOpacity: 0.04 }}
                  content={
                    <ChartTooltip
                      valueFormatter={(value) => `${percent(value, 2)} of total importance`}
                      showTotal={false}
                    />
                  }
                />
                <Bar dataKey="value" name="Importance" radius={[0, 4, 4, 0]} {...anim}>
                  {importances.map((item) => (
                    <Cell
                      key={item.feature}
                      fill="#0d9488"
                      fillOpacity={0.45 + (item.value / importanceTotal) * 2.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartCard>

            <Card className="flex flex-col">
              <CardBody className="flex-1">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Timer className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  Training environment
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Versions that produced the current artifacts — worth recording, because a metric is
                  only reproducible with the same stack.
                </p>

                <MetricGrid cols={2} className="mt-4">
                  <Metric label="Python" value={data.environment?.python} />
                  <Metric label="scikit-learn" value={data.environment?.sklearn} />
                  <Metric label="pandas" value={data.environment?.pandas} />
                  <Metric label="NumPy" value={data.environment?.numpy} />
                  <Metric label="Platform" value={data.environment?.platform} className="col-span-2" />
                  <Metric
                    label="Total samples"
                    value={number(data.split?.total_samples ?? data.total_samples)}
                    className="col-span-2"
                  />
                </MetricGrid>
              </CardBody>

              <div className="border-t border-slate-200/80 px-5 py-3 dark:border-slate-800">
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Median-imputed values are the same ones stored in{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                    models/metrics.json
                  </code>
                  , so inference never re-derives a different fill value.
                </p>
              </div>
            </Card>
          </div>

          {/* ------------------------------------------------------ classes */}
          {info.data?.classes?.length ? (
            <Card>
              <CardBody>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  What each class means
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {info.data.classes.map((item) => {
                    const meta = classMeta(item.label)
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200/80 p-3.5 dark:border-slate-800"
                        style={{ borderLeft: `3px solid ${meta.color}` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {item.label}
                          </span>
                          <Badge className={meta.badge}>class {item.id}</Badge>
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {item.audience}
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {item.recommendation}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* ----------------------------------------------------- workflow */}
          <WorkflowDiagram
            steps={workflowSteps}
            targetRule={workflow.data?.target_rule}
            featureGroups={workflow.data?.feature_groups ?? []}
          />

          <Callout tone="warning" icon={FileWarning} title="The caveat that matters most">
            The class label is not an independent ground truth — it is computed from CO(GT), NOx(GT)
            and NO2(GT) thresholds, and those same three columns are model inputs. A high accuracy on a
            random split therefore partly measures how well the forest reproduces a deterministic
            function of its own inputs. Report it as &ldquo;the model reproduces the published
            labelling rule&rdquo;, not as &ldquo;the model detects air pollution&rdquo;. A spatial or
            temporal split across stations would be the honest next evaluation.
          </Callout>

          <Callout tone="info" title="Reproduce these numbers">
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
              python -m backend.ml.train
            </code>{' '}
            retrains from the committed CSV with the same random seed ({data.split?.random_state ?? 42})
            and rewrites every figure on this page.
          </Callout>
        </div>
      </AsyncBoundary>
    </div>
  )
}
