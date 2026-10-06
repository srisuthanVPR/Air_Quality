/**
 * Dashboard — the app's home screen.
 *
 * One request (`/api/dashboard`) supplies every tile and chart, so the page
 * shows a single consistent snapshot rather than several independently-loading
 * panels that can disagree with each other.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Cpu,
  Database,
  Gauge,
  History,
  Layers,
  Radio,
  Sparkles,
  Target,
  Thermometer,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '../components/PageHeader.jsx'
import { StatCard } from '../components/StatCard.jsx'
import { CorrelationHeatmap } from '../components/charts/CorrelationHeatmap.jsx'
import { ChartCard, ChartTooltip } from '../components/charts/ChartCard.jsx'
import { axisTickFormatter, useChartAnimation, useChartTheme } from '../components/charts/chartTheme.jsx'
import {
  AsyncBoundary,
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  EmptyState,
  ProgressBar,
} from '../components/UI.jsx'
import { useApi, useIsMobile } from '../hooks/useApi.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { getDashboard } from '../services/api.js'
import { classMeta } from '../utils/aqi.js'
import { cn } from '../utils/cn.js'
import { decimal, number, percent, relativeTime } from '../utils/formatters.js'

export default function Dashboard() {
  useDocumentTitle('Dashboard')

  const { data, error, loading, refresh } = useApi(getDashboard, [])
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  // Chart config is theme-dependent, so it must come from hooks called at the
  // top of the component rather than inline inside the JSX.
  const theme = useChartTheme()
  const anim = useChartAnimation()

  const kpis = data?.kpis ?? {}
  const model = data?.model ?? {}
  const dataset = data?.dataset ?? {}
  const history = data?.history_statistics ?? {}
  const recent = data?.recent_predictions ?? []
  const distribution = dataset.class_distribution ?? {}

  // Temperature and humidity arrive as two separate hourly profiles; merge them
  // on the hour key so both lines share one x axis with two y scales.
  const weather = useMemo(() => {
    const humidity = new Map(
      (dataset.humidity_profile ?? []).map((point) => [String(point.key ?? point.label), point]),
    )
    return (dataset.temperature_profile ?? []).map((point) => {
      const key = String(point.key ?? point.label)
      const wet = humidity.get(key)
      return {
        label: point.label,
        key,
        temperature: point.mean,
        temperatureMin: point.min,
        temperatureMax: point.max,
        humidity: wet?.mean ?? null,
        count: point.count ?? wet?.count ?? 0,
      }
    })
  }, [dataset.temperature_profile, dataset.humidity_profile])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Model readiness, dataset scale and the state of your recent predictions — one snapshot from a single endpoint."
        icon={Gauge}
        action={
          <>
            <Link to="/predict" className="hidden sm:block">
              <Button variant="primary" icon={Sparkles}>
                New prediction
              </Button>
            </Link>
            <Button variant="secondary" icon={Activity} onClick={refresh} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={refresh}
        loadingRows={5}
        empty={
          <EmptyState
            icon={Database}
            title="No dashboard data"
            description="The backend responded but returned an empty payload."
          />
        }
      >
        <div className="flex flex-col gap-6">
          {/* --------------------------------------------------------- KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total readings"
              value={kpis.total_records}
              icon={Database}
              tone="brand"
              hint={`${number(kpis.training_records)} usable after cleaning`}
            />
            <StatCard
              label="Model accuracy"
              value={model.ready ? percent(model.accuracy) : null}
              icon={Target}
              tone={model.ready ? 'emerald' : 'slate'}
              hint={
                model.ready
                  ? `F1 ${percent(model.f1_score)} · ${number(model.test_samples)} held out`
                  : 'Model not loaded'
              }
            />
            <StatCard
              label="Predictions made"
              value={history.total ?? 0}
              icon={History}
              tone="violet"
              hint={
                history.total
                  ? `Avg confidence ${percent(history.mean_confidence)}`
                  : 'Nothing predicted yet'
              }
              onClick={() => navigate('/history')}
            />
            <StatCard
              label="Mean CO(GT)"
              value={kpis.averages?.['CO(GT)']}
              icon={TrendingUp}
              tone="amber"
              decimals={2}
              suffix="mg/m³"
              hint="Average across all usable readings"
            />
          </div>

          {/* ------------------------------------------------ class mix + trend */}
          <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
            <ClassDistributionCard distribution={distribution} />

            <ChartCard
              title="Average air quality by hour of day"
              subtitle="Lower is better — the daily pollution cycle peaks around rush hour."
              icon={Activity}
              height={isMobile ? 240 : 300}
              isEmpty={!dataset.hourly_profile?.length}
              emptyMessage="Hourly profile unavailable"
            >
              <AreaChart
                data={dataset.hourly_profile ?? []}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="aqHourFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...theme.gridProps} />
                <XAxis dataKey="label" {...theme.xAxisProps} interval={isMobile ? 3 : 1} />
                <YAxis {...theme.yAxisProps} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(value) => `${decimal(value, 2)} mg/m³`}
                      showTotal={false}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="mean"
                  name="Mean CO(GT)"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#aqHourFill)"
                  {...anim}
                />
              </AreaChart>
            </ChartCard>
          </div>

          {/* ------------------------------------------------- pollutant + weather */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="NOx by hour of day"
              subtitle="Mean and peak, in µg/m³. Wide gaps signal heavy-tailed spikes."
              icon={BarChart3}
              height={isMobile ? 240 : 280}
              isEmpty={!dataset.nox_profile?.length}
              emptyMessage="Hourly pollutant profile unavailable"
            >
              <BarChart
                data={dataset.nox_profile ?? []}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <CartesianGrid {...theme.gridProps} />
                <XAxis dataKey="label" {...theme.xAxisProps} interval={isMobile ? 3 : 1} />
                <YAxis {...theme.yAxisProps} tickFormatter={axisTickFormatter} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(value, entry) =>
                        `${decimal(value, 1)} µg/m³ ${entry.dataKey === 'max' ? 'peak' : 'mean'}`
                      }
                      showTotal={false}
                    />
                  }
                />
                <Bar dataKey="mean" name="Mean NOx" fill="#0ea5e9" radius={[3, 3, 0, 0]} {...anim} />
                <Bar
                  dataKey="max"
                  name="Peak NOx"
                  fill="#0ea5e9"
                  opacity={0.26}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ChartCard>

            <ChartCard
              title="Temperature and humidity"
              subtitle="Weather drives sensor readings, so context matters when reading a class."
              icon={Thermometer}
              height={isMobile ? 240 : 280}
              isEmpty={!weather.length}
              emptyMessage="Weather profile unavailable"
            >
              <LineChart data={weather} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...theme.gridProps} />
                <XAxis dataKey="label" {...theme.xAxisProps} interval={isMobile ? 3 : 1} />
                <YAxis
                  yAxisId="temperature"
                  {...theme.yAxisProps}
                  tickFormatter={(value) => `${decimal(value, 0)}°`}
                />
                <YAxis
                  yAxisId="humidity"
                  orientation="right"
                  {...theme.yAxisProps}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${decimal(value, 0)}%`}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(label) => `${label}:00`}
                      valueFormatter={(value, entry) =>
                        entry.name === 'Temperature'
                          ? `${decimal(value, 1)} °C`
                          : `${decimal(value, 1)} %`
                      }
                      showTotal={false}
                    />
                  }
                />
                <Line
                  yAxisId="humidity"
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  {...anim}
                />
                <Line
                  yAxisId="temperature"
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  {...anim}
                />
              </LineChart>
            </ChartCard>
          </div>

          {/* ------------------------------------------------------ correlation */}
          <CorrelationHeatmap
            columns={dataset.correlation?.columns ?? []}
            matrix={dataset.correlation?.matrix ?? []}
            subtitle="Pearson r between every pair of model inputs. Hover any cell for the exact value."
            height={430}
          />

          {/* ------------------------------------------ model + recent activity */}
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <ModelCard model={model} dataset={dataset} />

            <Card className="flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <History className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Recent predictions
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Latest 8 stored locally</p>
                  </div>
                </div>
                <Link to="/history">
                  <Button size="sm" variant="ghost" iconRight={ArrowRight}>
                    All
                  </Button>
                </Link>
              </div>

              {recent.length ? (
                <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {recent.map((item) => {
                    const label = item.label ?? item.category ?? 'Unknown'
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <span
                          className={cn('size-2.5 shrink-0 rounded-full', classMeta(label).dot)}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                            {label}
                          </p>
                          <p className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                            {percent(item.confidence, 0)} · {relativeTime(item.created_at)}
                          </p>
                        </div>
                        <Badge className={classMeta(label).badge}>{label}</Badge>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={Sparkles}
                  title="No predictions yet"
                  description="Make your first prediction and it will appear here."
                  action={
                    <Link to="/predict">
                      <Button size="sm" variant="primary">
                        Predict now
                      </Button>
                    </Link>
                  }
                />
              )}
            </Card>
          </div>

          {model.ready ? (
            <Callout tone="info" icon={Radio} title="Reading these numbers">
              Accuracy of {percent(model.accuracy)} comes from a held-out split of{' '}
              {number(model.test_samples)} readings — but the class label is itself derived from three
              of the twelve inputs. See{' '}
              <Link to="/about" className="font-semibold underline underline-offset-2">
                About
              </Link>{' '}
              for why that matters before quoting this figure.
            </Callout>
          ) : (
            <Callout tone="warning" icon={Layers} title="No trained model found">
              The API is running but{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
                models/model.pkl
              </code>{' '}
              is missing. Train it with{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
                python -m backend.ml.train
              </code>
              , then refresh this page.
            </Callout>
          )}
        </div>
      </AsyncBoundary>
    </div>
  )
}

/** Class balance as a stacked bar plus a legend with counts and percentages. */
function ClassDistributionCard({ distribution }) {
  const entries = Object.entries(distribution.counts ?? {})
  const total = distribution.total ?? 0

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-400">
          <Layers className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Class balance</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {number(total)} labelled readings
          </p>
        </div>
      </div>

      <CardBody className="flex flex-1 flex-col justify-center">
        {entries.length ? (
          <>
            <div className="flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {entries.map(([label, value]) => (
                <div
                  key={label}
                  className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${((value / total) * 100).toFixed(2)}%`,
                    backgroundColor: distribution.colors?.[label] ?? classMeta(label).color,
                  }}
                  title={`${label}: ${number(value)} (${distribution.percentages?.[label]}%)`}
                />
              ))}
            </div>

            <ul className="mt-5 space-y-3">
              {entries.map(([label, value]) => (
                <li key={label}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span
                        className={cn('size-2 shrink-0 rounded-full', classMeta(label).dot)}
                        aria-hidden="true"
                      />
                      {label}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {number(value)}
                      <span className="ml-1.5 font-normal text-slate-400">
                        {distribution.percentages?.[label]}%
                      </span>
                    </span>
                  </div>
                  <ProgressBar
                    value={value}
                    max={total}
                    color={distribution.colors?.[label]}
                    height="h-1.5"
                    label={`${label} share`}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState compact title="No class distribution available" />
        )}
      </CardBody>
    </Card>
  )
}

/** Model readiness, split sizes and dataset provenance. */
function ModelCard({ model, dataset }) {
  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400">
            <Cpu className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Model status</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{model.algorithm ?? 'Not loaded'}</p>
          </div>
        </div>
        <Badge
          className={
            model.ready
              ? classMeta('Good').badge
              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300'
          }
          dot
        >
          {model.ready ? 'Ready' : 'Unavailable'}
        </Badge>
      </div>

      <CardBody>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <QuickStat label="Accuracy" value={model.ready ? percent(model.accuracy) : null} />
          <QuickStat label="Precision" value={model.ready ? percent(model.precision) : null} />
          <QuickStat label="Recall" value={model.ready ? percent(model.recall) : null} />
          <QuickStat label="F1 (weighted)" value={model.ready ? percent(model.f1_score) : null} />
        </dl>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-4 sm:grid-cols-4 dark:border-slate-800">
          <QuickStat label="Features" value={number(model.n_features)} />
          <QuickStat label="Train rows" value={number(model.train_samples)} />
          <QuickStat label="Test rows" value={number(model.test_samples)} />
          <QuickStat label="Trained" value={relativeTime(model.trained_at)} small />
        </dl>

        {dataset?.date_range ? (
          <p className="mt-4 border-t border-slate-200/80 pt-4 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Dataset spans{' '}
            <span className="font-semibold">{String(dataset.date_range.start).slice(0, 10)}</span> to{' '}
            <span className="font-semibold">{String(dataset.date_range.end).slice(0, 10)}</span> (
            {number(dataset.date_range.days)} days), recorded hourly at a single monitoring station.
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}

function QuickStat({ label, value, small = false }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 font-mono font-bold text-slate-900 dark:text-white',
          small ? 'text-[11px]' : 'text-sm',
        )}
      >
        {value ?? '—'}
      </dd>
    </div>
  )
}
