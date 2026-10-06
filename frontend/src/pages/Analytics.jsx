/**
 * Analytics.
 *
 * Temporal and distribution views over the cleaned dataset, with an optional
 * date window and a metric switch. One request backs the whole page so the
 * date filter stays consistent across every chart.
 *
 * Response shape consumed here (see backend/routes/analytics.py):
 *   metric, metric_label, unit, group_by, range, available_metrics,
 *   time_series[], distributions{}, class_distribution{}, correlation{},
 *   scatter{ pairs[] }, hourly_profile[], daily_profile[]
 */
import { useCallback, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CalendarRange,
  Clock,
  Database,
  LineChart as LineChartIcon,
  RotateCcw,
  Waves,
} from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '../components/PageHeader.jsx'
import { StatCard } from '../components/StatCard.jsx'
import { ChartCard, ChartLegend, ChartTooltip } from '../components/charts/ChartCard.jsx'
import { CorrelationHeatmap } from '../components/charts/CorrelationHeatmap.jsx'
import { axisTickFormatter, useChartAnimation, useChartTheme } from '../components/charts/chartTheme.jsx'
import {
  AsyncBoundary,
  Button,
  Callout,
  Card,
  CardBody,
  EmptyState,
  Metric,
  MetricGrid,
  SegmentedControl,
} from '../components/UI.jsx'
import { useApi, useDebouncedValue, useIsMobile } from '../hooks/useApi.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { getAnalytics } from '../services/api.js'
import { CLASS_ORDER, classMeta } from '../utils/aqi.js'
import { decimal, number, percent } from '../utils/formatters.js'

/** Fallback list; the API sends the authoritative `available_metrics`. */
const FALLBACK_METRICS = [
  { key: 'CO(GT)', label: 'CO(GT)', unit: 'mg/m³', group: 'pollutant' },
  { key: 'NOx(GT)', label: 'NOx(GT)', unit: 'µg/m³', group: 'pollutant' },
  { key: 'NO2(GT)', label: 'NO2(GT)', unit: 'µg/m³', group: 'pollutant' },
  { key: 'C6H6(GT)', label: 'C6H6(GT)', unit: 'µg/m³', group: 'pollutant' },
  { key: 'T', label: 'Temperature', unit: '°C', group: 'meteorology' },
  { key: 'RH', label: 'Humidity', unit: '%', group: 'meteorology' },
]

const SERIES_COLORS = {
  Good: classMeta('Good').color,
  Moderate: classMeta('Moderate').color,
  Unhealthy: classMeta('Unhealthy').color,
  'Very Unhealthy': classMeta('Very Unhealthy').color,
}

export default function Analytics() {
  useDocumentTitle('Analytics')

  const [metric, setMetric] = useState('CO(GT)')
  const [range, setRange] = useState({ start: '', end: '' })
  const debouncedRange = useDebouncedValue(range, 400)
  const isMobile = useIsMobile()

  const params = useMemo(
    () => ({
      metric,
      start: debouncedRange.start || undefined,
      end: debouncedRange.end || undefined,
    }),
    [metric, debouncedRange],
  )

  const { data, error, loading, refresh } = useApi(
    useCallback(() => getAnalytics(params), [params]),
    [params],
  )

  const theme = useChartTheme()
  const anim = useChartAnimation()

  const available = data?.available_metrics?.length ? data.available_metrics : FALLBACK_METRICS
  const activeMetric = available.find((item) => item.key === metric) ?? available[0] ?? FALLBACK_METRICS[0]
  const unit = data?.unit ?? activeMetric?.unit ?? ''

  const range_ = data?.range ?? {}
  const series = useMemo(() => data?.time_series ?? [], [data])
  const daily = useMemo(() => data?.daily_profile ?? [], [data])
  const hourly = useMemo(() => data?.hourly_profile ?? [], [data])
  const distribution = data?.distributions?.[metric] ?? null
  const classDist = useMemo(() => data?.class_distribution ?? {}, [data])
  const pairs = data?.scatter?.pairs ?? []
  const [pairIndex, setPairIndex] = useState(0)
  const activePair = pairs[Math.min(pairIndex, Math.max(pairs.length - 1, 0))] ?? null

  // Recharts draws a min–max band from a two-element array dataKey.
  const seriesWithBand = useMemo(
    () => series.map((point) => ({ ...point, band: [point.min, point.max] })),
    [series],
  )

  const resetRange = () => setRange({ start: '', end: '' })
  const hasRangeFilter = Boolean(range.start || range.end)

  // The class donut/bar is easier to read as one row per known class.
  const classRows = useMemo(() => {
    const counts = classDist.counts ?? {}
    const percentages = classDist.percentages ?? {}
    return CLASS_ORDER.filter((label) => counts[label] !== undefined).map((label) => ({
      label,
      count: counts[label],
      percentage: percentages[label],
      color: classDist.colors?.[label] ?? classMeta(label).color,
    }))
  }, [classDist])

  const dominant = useMemo(() => {
    const top = [...classRows].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]
    return top ?? null
  }, [classRows])

  const histogram = useMemo(() => {
    if (!distribution?.centres?.length) return []
    return distribution.centres.map((centre, index) => ({
      centre: Number(centre),
      label: decimal(centre, distribution.centres.length > 12 ? 0 : 1),
      count: distribution.counts?.[index] ?? 0,
    }))
  }, [distribution])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Temporal patterns, pollutant correlations and class balance across the cleaned dataset."
        icon={LineChartIcon}
        action={
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={resetRange}
            disabled={!hasRangeFilter}
          >
            Clear date filter
          </Button>
        }
      />

      {/* ------------------------------------------------------------ filters */}
      <Card>
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="field-label mb-2">Trend metric</p>
            <SegmentedControl
              options={available.map((item) => ({
                value: item.key,
                label: item.label,
                title: `${item.label} (${item.unit ?? ''})`,
              }))}
              value={metric}
              onChange={setMetric}
              size="sm"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="analytics-start" className="field-label mb-1.5">
                From
              </label>
              <input
                id="analytics-start"
                type="date"
                value={range.start}
                max={range.end || undefined}
                onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))}
                className="field w-auto"
              />
            </div>
            <div>
              <label htmlFor="analytics-end" className="field-label mb-1.5">
                To
              </label>
              <input
                id="analytics-end"
                type="date"
                value={range.end}
                min={range.start || undefined}
                onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))}
                className="field w-auto"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={refresh}
        loadingRows={5}
        empty={
          <EmptyState
            icon={CalendarRange}
            title="No readings in this window"
            description="Widen the date range to see analytics."
            action={
              <Button variant="secondary" onClick={resetRange}>
                Clear filter
              </Button>
            }
          />
        }
      >
        {!range_?.rows ? (
          <Card>
            <EmptyState
              icon={CalendarRange}
              title="No readings in this window"
              description="Nothing falls inside the selected dates."
              action={
                <Button variant="secondary" onClick={resetRange}>
                  Clear filter
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {/* -------------------------------------------------------- KPI row */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Readings analysed"
                value={range_.rows ?? 0}
                icon={Database}
                tone="brand"
                hint={
                  range_.start && range_.end
                    ? `${String(range_.start).slice(0, 10)} → ${String(range_.end).slice(0, 10)}`
                    : 'Whole dataset'
                }
              />
              <StatCard
                label={`Mean ${activeMetric?.label ?? metric}`}
                value={distribution?.mean}
                icon={Activity}
                tone="violet"
                decimals={2}
                suffix={unit}
                hint={`Median ${decimal(distribution?.median, 2)} ${unit}`}
              />
              <StatCard
                label="Peak value"
                value={distribution?.max}
                icon={Waves}
                tone="amber"
                decimals={2}
                suffix={unit}
                hint={`Lowest ${decimal(distribution?.min, 2)} ${unit}`}
              />
              <StatCard
                label="Dominant class"
                value={dominant?.label ?? '—'}
                icon={BarChart3}
                tone="slate"
                decimals={0}
                hint={
                  dominant?.percentage != null
                    ? `${decimal(dominant.percentage, 1)}% of readings`
                    : 'Share of readings'
                }
              />
            </div>

            {/* ----------------------------------------------------- main trend */}
            <ChartCard
              title={`${activeMetric?.label ?? metric} over time`}
              subtitle={
                series.length
                  ? `${number(series.length)} ${String(data?.group_by ?? 'hour')} buckets · mean with min–max band, in ${unit}`
                  : `Mean in ${unit}`
              }
              icon={LineChartIcon}
              height={isMobile ? 260 : 340}
              isEmpty={!series.length}
              emptyMessage="No aggregates for this window"
              footer={
                <>
                  The shaded band is the min–max envelope across readings inside each bucket; the line
                  is the mean. Buckets are {data?.group_by === 'day' ? 'calendar days' : 'hours of the day'}.
                </>
              }
            >
              <ComposedChart data={seriesWithBand} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="analyticsBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...theme.gridProps} />
                <XAxis
                  dataKey="label"
                  {...theme.xAxisProps}
                  interval={isMobile ? 6 : 3}
                  minTickGap={12}
                />
                <YAxis {...theme.yAxisProps} tickFormatter={axisTickFormatter} />
                <ReferenceLine
                  y={Number(distribution?.mean) || 0}
                  stroke="#0ea5e9"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(label) =>
                        data?.group_by === 'day' ? `Day ${label}` : `${label}:00`
                      }
                      valueFormatter={(value, entry) =>
                        entry.dataKey === 'band'
                          ? `${decimal(entry.payload?.min, 2)}–${decimal(entry.payload?.max, 2)} ${unit}`
                          : `${decimal(value, 2)} ${unit}`
                      }
                      showTotal={false}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  name="min–max"
                  stroke="none"
                  fill="url(#analyticsBand)"
                  {...anim}
                />
                <Line
                  type="monotone"
                  dataKey="mean"
                  name="mean"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={false}
                  {...anim}
                />
              </ComposedChart>
            </ChartCard>

            {/* ----------------------------------------- distributions + scatter */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title={`${activeMetric?.label ?? metric} distribution`}
                subtitle={
                  histogram.length
                    ? `${number(distribution?.total ?? 0)} readings in ${histogram.length} bins`
                    : 'Histogram of readings'
                }
                icon={BarChart3}
                height={isMobile ? 240 : 300}
                isEmpty={!histogram.length}
                footer={
                  <>
                    Bins are equal-width across the observed range
                    {distribution?.min != null
                      ? ` (${decimal(distribution.min, 2)}–${decimal(distribution.max, 2)} ${unit})`
                      : ''}
                    . Values inside the accepted range but outside the observed one are included.
                  </>
                }
              >
                <BarChart data={histogram} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid {...theme.gridProps} />
                  <XAxis
                    dataKey="label"
                    {...theme.xAxisProps}
                    interval={isMobile ? 'preserveStartEnd' : Math.ceil(histogram.length / 8) - 1}
                    angle={0}
                  />
                  <YAxis {...theme.yAxisProps} allowDecimals={false} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(value) => `${number(value)} readings`}
                        showTotal={false}
                      />
                    }
                  />
                  <Bar dataKey="count" name="Readings" fill="#0d9488" radius={[4, 4, 0, 0]} {...anim} />
                </BarChart>
              </ChartCard>

              <ChartCard
                title="Class balance"
                subtitle="Share of readings in each air-quality band for this window."
                icon={BarChart3}
                height={isMobile ? 240 : 300}
                isEmpty={!classRows.length}
                action={
                  <ChartLegend
                    items={classRows.map((row) => ({ label: row.label, color: row.color }))}
                    className="max-w-40 justify-end"
                  />
                }
              >
                <BarChart
                  data={classRows}
                  layout="vertical"
                  margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
                >
                  <CartesianGrid {...theme.gridProps} horizontal={false} />
                  <XAxis type="number" {...theme.xAxisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" {...theme.yAxisProps} width={104} />
                  <Tooltip
                    cursor={{ fill: 'currentColor', fillOpacity: 0.04 }}
                    content={
                      <ChartTooltip
                        valueFormatter={(value) => `${number(value)} readings`}
                        showTotal={false}
                      />
                    }
                  />
                  <Bar dataKey="count" name="Readings" radius={[0, 4, 4, 0]} {...anim}>
                    {classRows.map((row) => (
                      <Cell key={row.label} fill={row.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartCard>
            </div>

            {/* -------------------------------------------- hourly + day-of-month */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Hour-of-day profile"
                subtitle="Average level by clock hour — traffic and combustion peaks are visible here."
                icon={Clock}
                height={isMobile ? 240 : 300}
                isEmpty={!hourly.length}
              >
                <ComposedChart data={hourly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid {...theme.gridProps} />
                  <XAxis dataKey="label" {...theme.xAxisProps} interval={isMobile ? 3 : 1} />
                  <YAxis {...theme.yAxisProps} tickFormatter={axisTickFormatter} />
                  <ReferenceLine
                    y={Number(distribution?.mean) || 0}
                    stroke="#0ea5e9"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(label) => `${label}:00`}
                        valueFormatter={(value) => `${decimal(value, 2)} ${unit}`}
                        showTotal={false}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="max"
                    name="peak"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    {...anim}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    name="mean"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={false}
                    {...anim}
                  />
                </ComposedChart>
              </ChartCard>

              <ChartCard
                title="Day-of-month profile"
                subtitle="Average level by calendar day, useful for spotting episodic spikes."
                icon={LineChartIcon}
                height={isMobile ? 240 : 300}
                isEmpty={!daily.length}
              >
                <ComposedChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid {...theme.gridProps} />
                  <XAxis dataKey="label" {...theme.xAxisProps} interval={isMobile ? 4 : 2} />
                  <YAxis {...theme.yAxisProps} tickFormatter={axisTickFormatter} />
                  <ReferenceLine
                    y={Number(distribution?.mean) || 0}
                    stroke="#0ea5e9"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(label) => `Day ${label}`}
                        valueFormatter={(value) => `${decimal(value, 2)} ${unit}`}
                        showTotal={false}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="max"
                    name="peak"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    {...anim}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    name="mean"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={false}
                    {...anim}
                  />
                </ComposedChart>
              </ChartCard>
            </div>

            {/* --------------------------------------------------- scatter pairs */}
            <ChartCard
              title={
                activePair
                  ? `${activePair.y_label ?? activePair.y} vs ${activePair.x_label ?? activePair.x}`
                  : 'Feature relationship'
              }
              subtitle={
                activePair
                  ? `${number(activePair.points?.length ?? 0)} sampled readings · x: ${activePair.x_unit ?? ''}, y: ${activePair.y_unit ?? ''}`
                  : undefined
              }
              icon={Activity}
              height={isMobile ? 260 : 340}
              isEmpty={!activePair?.points?.length}
              emptyMessage="Not enough data to plot this pair"
              action={
                pairs.length > 1 ? (
                  <SegmentedControl
                    options={pairs.map((pair, index) => ({
                      value: String(index),
                      label: `${pair.y_label ?? pair.y} / ${pair.x_label ?? pair.x}`,
                      title: `${pair.y_label ?? pair.y} vs ${pair.x_label ?? pair.x}`,
                    }))}
                    value={String(Math.min(pairIndex, pairs.length - 1))}
                    onChange={(value) => setPairIndex(Number(value))}
                    size="sm"
                  />
                ) : null
              }
            >
              <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid {...theme.gridProps} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={activePair?.x_label}
                  {...theme.xAxisProps}
                  tickFormatter={axisTickFormatter}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={activePair?.y_label}
                  {...theme.yAxisProps}
                  tickFormatter={axisTickFormatter}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={
                    <ChartTooltip
                      labelFormatter={() => ''}
                      valueFormatter={(value, entry) =>
                        `${decimal(value, 2)} ${
                          entry.dataKey === 'x'
                            ? (activePair?.x_unit ?? '')
                            : (activePair?.y_unit ?? '')
                        }`
                      }
                      showTotal={false}
                    />
                  }
                />
                {CLASS_ORDER.map((name) => (
                  <Scatter
                    key={name}
                    name={name}
                    data={activePair?.points?.filter((point) => point.category === name) ?? []}
                    fill={SERIES_COLORS[name]}
                    fillOpacity={0.6}
                    {...anim}
                  />
                ))}
              </ScatterChart>
            </ChartCard>

            <CorrelationHeatmap
              columns={data?.correlation?.columns ?? []}
              matrix={data?.correlation?.matrix ?? []}
              subtitle="Pearson r, computed over the filtered window."
              height={430}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <div className="px-5 pt-4 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeMetric?.label ?? metric} statistics
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Descriptive statistics for the filtered window
                  </p>
                </div>
                <CardBody className="pt-0">
                  <MetricGrid cols={2}>
                    <Metric label="Mean" value={`${decimal(distribution?.mean, 2)} ${unit}`} />
                    <Metric label="Median" value={`${decimal(distribution?.median, 2)} ${unit}`} />
                    <Metric label="Minimum" value={`${decimal(distribution?.min, 2)} ${unit}`} />
                    <Metric label="Maximum" value={`${decimal(distribution?.max, 2)} ${unit}`} />
                    <Metric label="Readings" value={number(distribution?.total ?? 0)} />
                    <Metric
                      label="Share of window"
                      value={
                        range_.rows
                          ? percent((distribution?.total ?? 0) / Math.max(range_.rows, 1), 1)
                          : '—'
                      }
                    />
                  </MetricGrid>
                </CardBody>
              </Card>

              <Callout tone="info" title="How these aggregates are built">
                Every view uses only the rows that survived cleaning, so counts are lower than the raw
                file. Missing cells are filled with the training median before aggregation, which
                flattens extremes slightly — visible as a narrower min–max envelope than the raw data
                would produce. The window currently covers {number(range_.rows ?? 0)} readings
                {range_.start ? ` from ${String(range_.start).slice(0, 10)}` : ''}
                {range_.end ? ` to ${String(range_.end).slice(0, 10)}` : ''}.
              </Callout>
            </div>
          </div>
        )}
      </AsyncBoundary>
    </div>
  )
}
