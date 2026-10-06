/**
 * Dataset explorer.
 *
 * The raw file is far too large to ship to the browser, so the table is
 * server-side: pagination, sorting, search and the date window all run in
 * `GET /api/dataset/sample` and only one page of rows is ever returned.
 *
 * The column panel is built from `/api/dataset/summary`, which reports missing
 * counts per column and says explicitly why the three non-feature columns were
 * excluded — the UI shows that reason rather than hiding them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Download,
  Filter,
  Info,
  RotateCcw,
  Search,
  Table2,
  TriangleAlert,
} from 'lucide-react'

import { PageHeader } from '../components/PageHeader.jsx'
import { StatCard } from '../components/StatCard.jsx'
import {
  AsyncBoundary,
  Button,
  Callout,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  Metric,
  MetricGrid,
  NeutralBadge,
  ProgressBar,
} from '../components/UI.jsx'
import { useApi, useDebouncedValue } from '../hooks/useApi.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { downloadFromUrl, getDatasetDownloadUrl, getDatasetRows, getDatasetSummary } from '../services/api.js'
import { bytes as formatBytes, decimal, number, percent, plural } from '../utils/formatters.js'

const PAGE_SIZES = [25, 50, 100]

/** Cell text that keeps small sensor readings legible instead of rounding to 1. */
function cell(value) {
  if (typeof value !== 'number') return value === null || value === undefined ? '—' : String(value)
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/** Columns that make sense as a "missingness" leaderboard. */
function missingnessRank(columns = []) {
  return [...columns]
    .filter((column) => column.missing > 0)
    .sort((a, b) => (b.missing_pct ?? 0) - (a.missing_pct ?? 0))
}

export default function DatasetExplorer() {
  useDocumentTitle('Dataset')

  const summary = useApi(getDatasetSummary, [])

  // --- table controls (all server-side) -------------------------------------
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sort, setSort] = useState('DateTime')
  const [order, setOrder] = useState('asc')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState({ start: '', end: '' })
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const debouncedSearch = useDebouncedValue(search, 350)
  const debouncedRange = useDebouncedValue(range, 400)

  // Filter changes must reset pagination. Doing it in the change handlers would
  // miss the debounced value landing, so it is applied when the debounce does.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, debouncedRange, pageSize, sort, order])

  const params = useMemo(
    () => ({
      page,
      page_size: pageSize,
      sort,
      order,
      search: debouncedSearch || undefined,
      start: debouncedRange.start || undefined,
      end: debouncedRange.end || undefined,
    }),
    [page, pageSize, sort, order, debouncedSearch, debouncedRange],
  )

  const table = useApi(
    useCallback(() => getDatasetRows(params), [params]),
    [params],
  )

  // A narrower result set can leave the viewer on a page that no longer exists.
  useEffect(() => {
    const lastPage = Math.max(table.data?.total_pages ?? 1, 1)
    if (page > lastPage) setPage(lastPage)
  }, [table.data, page])

  const data = summary.data ?? {}
  const rows = table.data?.rows ?? []
  const columns = table.data?.columns ?? []
  const totalRows = table.data?.total ?? 0
  const totalPages = table.data?.total_pages ?? 0
  const hasFilters = Boolean(debouncedSearch || debouncedRange.start || debouncedRange.end)

  const featureStats = data.stats ?? {}
  const ranked = useMemo(() => missingnessRank(data.columns), [data.columns])

  const resetFilters = () => {
    setSearch('')
    setRange({ start: '', end: '' })
    setPage(1)
  }

  const toggleSort = (column) => {
    if (sort === column) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(column)
      setOrder('asc')
    }
  }

  const download = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadFromUrl(getDatasetDownloadUrl(), data.filename ?? 'AirQualityUCI.csv')
    } catch (error) {
      setDownloadError(error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dataset explorer"
        description="Every cleaning step the pipeline applies, and the rows it worked on — served a page at a time."
        icon={Database}
        action={
          <Button
            variant="secondary"
            icon={Download}
            loading={downloading}
            onClick={download}
            title="Download the complete raw CSV"
          >
            Download CSV
          </Button>
        }
      />

      {downloadError ? <ErrorBanner error={downloadError} onRetry={download} /> : null}

      <AsyncBoundary
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.refresh}
        loadingRows={4}
      >
        <div className="flex flex-col gap-6">
          {/* -------------------------------------------------------- KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Rows in file"
              value={data.total_rows}
              icon={Database}
              tone="brand"
              hint={`${number(data.total_columns)} columns · ${formatBytes(data.memory_bytes)} in memory`}
            />
            <StatCard
              label="Rows used for training"
              value={data.valid_rows}
              icon={Filter}
              tone="emerald"
              hint={`${percent(data.valid_rows / Math.max(data.total_rows ?? 1, 1))} survived cleaning`}
            />
            <StatCard
              label="Missing cells"
              value={data.missing_values}
              icon={TriangleAlert}
              tone="amber"
              hint="Blank and -200 sentinel values, before imputation"
            />
            <StatCard
              label="Coverage"
              value={
                data.date_range?.start
                  ? `${decimal(data.date_range.days, 0)}`
                  : null
              }
              icon={Table2}
              tone="violet"
              decimals={0}
              suffix="days"
              hint={
                data.date_range?.start
                  ? `${String(data.date_range.start).slice(0, 10)} → ${String(data.date_range.end).slice(0, 10)}`
                  : undefined
              }
            />
          </div>

          {/* ------------------------------------------------- cleaning ledger */}
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card>
              <CardBody>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  What cleaning removed
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Rows dropped before training, and why.
                </p>

                <MetricGrid cols={3} className="mt-4">
                  <Metric label="Rows in raw file" value={number(data.totals?.total)} />
                  <Metric
                    label="Rows trained on"
                    value={number(data.totals?.used_for_training)}
                    hint={`${number(
                      (data.totals?.total ?? 0) - (data.totals?.used_for_training ?? 0),
                    )} removed`}
                  />
                  <Metric label="Blank rows" value={number(data.totals?.blank_rows)} />
                </MetricGrid>

                <Callout tone="info" className="mt-4">
                  {data.totals?.sentinel_rows}
                </Callout>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Missing values by column
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Share of rows where each column was blank or -200 before imputation.
                </p>

                <ul className="mt-4 space-y-2.5">
                  {ranked.slice(0, 6).map((column) => (
                    <li key={column.name}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {column.name}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {number(column.missing)} · {decimal(column.missing_pct, 1)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={column.missing_pct ?? 0}
                        max={100}
                        color={(column.missing_pct ?? 0) > 20 ? '#f97316' : '#f59e0b'}
                        height="h-1.5"
                        label={`${column.name} missing share`}
                      />
                    </li>
                  ))}
                  {!ranked.length ? (
                    <li className="text-xs text-slate-400 dark:text-slate-500">
                      No missing values anywhere in the file.
                    </li>
                  ) : null}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* --------------------------------------------------- feature table */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Feature statistics</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The {plural(data.feature_columns?.length ?? 0, 'column')} the model actually reads
                </p>
              </div>
              <NeutralBadge>
                {number(featureStats['CO(GT)']?.count ?? 0)} rows with CO(GT) present
              </NeutralBadge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-left text-xs">
                <thead className="bg-slate-50 text-[10px] tracking-wider text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 font-bold">Column</th>
                    <th className="px-3 py-2.5 text-right font-bold">Count</th>
                    <th className="px-3 py-2.5 text-right font-bold">Mean</th>
                    <th className="px-3 py-2.5 text-right font-bold">Median</th>
                    <th className="px-3 py-2.5 text-right font-bold">Std dev</th>
                    <th className="px-3 py-2.5 text-right font-bold">Min</th>
                    <th className="px-3 py-2.5 text-right font-bold">Max</th>
                    <th className="px-5 py-2.5 text-right font-bold">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {(data.feature_columns ?? []).map((name) => {
                    const stat = featureStats[name] ?? {}
                    return (
                      <tr key={name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <th scope="row" className="px-5 py-2.5 font-mono font-semibold text-slate-700 dark:text-slate-200">
                          {name}
                        </th>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {number(stat.count)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {decimal(stat.mean, 2)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {decimal(stat.median, 2)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {decimal(stat.std, 2)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {decimal(stat.min, 1)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {decimal(stat.max, 1)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                          {number(stat.missing)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {Object.keys(data.excluded_columns ?? {}).length ? (
              <div className="border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  <Info className="size-3.5" aria-hidden="true" />
                  Columns present in the file but not used
                </p>
                <ul className="space-y-1.5">
                  {Object.entries(data.excluded_columns).map(([name, reason]) => (
                    <li key={name} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="font-mono font-semibold">{name}</span> — {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {/* ------------------------------------------------------ row table */}
          <Card className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Row browser</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {number(totalRows)} rows
                  {hasFilters ? ' match the current filters' : ' in the raw file'} · page {page} of{' '}
                  {number(Math.max(totalPages, 1))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="dataset-page-size" className="sr-only">
                  Rows per page
                </label>
                <select
                  id="dataset-page-size"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="field w-auto py-1.5 text-xs"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={resetFilters}
                  disabled={!hasFilters}
                >
                  Clear filters
                </Button>
              </div>
            </div>

            <CardBody className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <label htmlFor="dataset-search" className="field-label mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="dataset-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="e.g. 2.6 or 2004"
                    className="field pr-3 pl-9"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="dataset-start" className="field-label mb-1.5">
                  From
                </label>
                <input
                  id="dataset-start"
                  type="date"
                  value={range.start}
                  max={range.end || undefined}
                  onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))}
                  className="field w-auto"
                />
              </div>
              <div>
                <label htmlFor="dataset-end" className="field-label mb-1.5">
                  To
                </label>
                <input
                  id="dataset-end"
                  type="date"
                  value={range.end}
                  min={range.start || undefined}
                  onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))}
                  className="field w-auto"
                />
              </div>
            </CardBody>

            <AsyncBoundary
              loading={table.loading}
              error={table.error}
              onRetry={table.refresh}
              loadingRows={6}
              isEmpty={!rows.length}
              empty={
                <EmptyState
                  icon={Search}
                  title="No rows match"
                  description="Try a different search term or widen the date window."
                  action={
                    <Button variant="secondary" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              }
            >
              <div className="scroll-fade-x overflow-x-auto">
                <table className="w-full min-w-max text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] tracking-wider text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="px-3 py-2.5 font-bold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort(column)}
                            className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-100"
                            title={`Sort by ${column}`}
                          >
                            {column}
                            {sort === column ? (
                              order === 'asc' ? (
                                <ArrowUp className="size-3" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="size-3" aria-hidden="true" />
                              )
                            ) : null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                    {rows.map((row, index) => (
                      <tr
                        key={`${row.DateTime}-${index}`}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        {columns.map((column) => {
                          const raw = row[column]
                          const isMissing = raw === null || raw === undefined
                          const numeric = typeof raw === 'number'
                          return (
                            <td
                              key={column}
                              className={
                                isMissing
                                  ? 'px-3 py-2 font-mono text-amber-600/80 dark:text-amber-400/80'
                                  : numeric
                                    ? 'px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300'
                                    : 'px-3 py-2 font-mono whitespace-nowrap text-slate-600 dark:text-slate-300'
                              }
                            >
                              {cell(raw)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AsyncBoundary>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-3 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing{' '}
                {number(rows.length ? (page - 1) * pageSize + 1 : 0)}–
                {number((page - 1) * pageSize + rows.length)} of {number(totalRows)}
              </p>
              <div className="flex items-center gap-1">
                <IconButton
                  icon={ChevronsLeft}
                  label="First page"
                  variant="secondary"
                  disabled={page <= 1 || table.loading}
                  onClick={() => setPage(1)}
                />
                <IconButton
                  icon={ChevronsLeft}
                  label="Previous page"
                  variant="secondary"
                  disabled={page <= 1 || table.loading}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                />
                <span className="px-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {page} / {number(Math.max(totalPages, 1))}
                </span>
                <IconButton
                  icon={ChevronsRight}
                  label="Next page"
                  variant="secondary"
                  disabled={page >= totalPages || table.loading}
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                />
                <IconButton
                  icon={ChevronsRight}
                  label="Last page"
                  variant="secondary"
                  disabled={page >= totalPages || table.loading}
                  onClick={() => setPage(Math.max(totalPages, 1))}
                />
              </div>
            </div>
          </Card>

          <Callout tone="info" title="Reading the table">
            Values shown as <span className="font-mono font-semibold">—</span> were blank or the -200
            sentinel in the raw file. Training and inference both replace those with the training
            median for that column, which is why they can appear in this table but not as blanks in a
            prediction result.
          </Callout>
        </div>
      </AsyncBoundary>
    </div>
  )
}

/** Download failures need the same offline hint as everything else. */
function ErrorBanner({ error, onRetry }) {
  return (
    <Callout tone="danger" title="The CSV could not be downloaded" icon={TriangleAlert}>
      <p>{error?.message}</p>
      {error?.hint ? <p className="mt-1 opacity-80">{error.hint}</p> : null}
      <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </Callout>
  )
}
