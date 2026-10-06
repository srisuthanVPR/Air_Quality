/**
 * Prediction history.
 *
 * Rows live in a local SQLite table, so this page is a genuine read/delete
 * surface rather than a filtered view of React state. Filtering by class and
 * confidence happens client-side because the API deliberately exposes no search
 * parameters — with a local, per-user store that is both simpler and instant.
 */
import { useCallback, useMemo, useState } from 'react'
import {
  CircleX,
  Download,
  Filter,
  History as HistoryIcon,
  Info,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { ConfirmDialog } from '../components/ConfirmDialog.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { StatCard } from '../components/StatCard.jsx'
import {
  AsyncBoundary,
  Badge,
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
  SegmentedControl,
} from '../components/UI.jsx'
import { useApi, useDebouncedValue } from '../hooks/useApi.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { clearHistory, deleteHistoryItem, downloadText, getHistory } from '../services/api.js'
import { CLASS_ORDER, classMeta } from '../utils/aqi.js'
import { cn } from '../utils/cn.js'
import { decimal, formatDate, number, percent, relativeTime } from '../utils/formatters.js'

const FILTERS = [
  { value: 'all', label: 'All' },
  ...CLASS_ORDER.map((label) => ({ value: label, label })),
]

const HEADERS = ['id', 'created_at', 'timestamp', 'inputs', 'prediction', 'label', 'confidence', 'recommendation']

/** Flat JSON -> CSV, quoting anything containing a comma or quote. */
function toCsv(rows, columns) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const lines = [columns.join(',')]
  rows.forEach((row) => {
    lines.push(
      columns
        .map((column) =>
          escape(
            column === 'inputs'
              ? JSON.stringify(row.inputs ?? {})
              : column === 'created_at'
                ? (row.created_at ?? row.timestamp)
                : row[column],
          ),
        )
        .join(','),
    )
  })
  return lines.join('\n')
}

export default function History() {
  useDocumentTitle('History')

  const [limit, setLimit] = useState(200)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const debouncedSearch = useDebouncedValue(search, 300)
  const params = useMemo(() => ({ limit }), [limit])
  const { data, error, loading, refresh } = useApi(
    useCallback(() => getHistory(params), [params]),
    [params],
  )

  const items = useMemo(() => data?.items ?? [], [data])
  const stats = data?.statistics ?? {}

  const rows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && item.label !== filter) return false
      if (!needle) return true
      return (
        String(item.label ?? '').toLowerCase().includes(needle) ||
        String(item.recommendation ?? '').toLowerCase().includes(needle) ||
        JSON.stringify(item.inputs ?? {}).toLowerCase().includes(needle)
      )
    })
  }, [items, filter, debouncedSearch])

  const remove = async () => {
    if (!pendingDelete) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteHistoryItem(pendingDelete.id)
      setPendingDelete(null)
      await refresh()
    } catch (caught) {
      setActionError(caught)
    } finally {
      setBusy(false)
    }
  }

  const wipe = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await clearHistory()
      setConfirmClear(false)
      await refresh()
    } catch (caught) {
      setActionError(caught)
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    if (!rows.length) return
    downloadText(toCsv(rows, HEADERS), 'prediction-history.csv')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Prediction history"
        description="Every prediction you saved, with the exact readings that produced it."
        icon={HistoryIcon}
        action={
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={exportCsv}
              disabled={!rows.length}
              title="Export the filtered rows as CSV"
            >
              Export CSV
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => setConfirmClear(true)}
              disabled={!items.length}
            >
              Clear all
            </Button>
          </>
        }
      />

      {actionError ? (
        <Callout tone="danger" icon={TriangleAlert} title="That action did not complete">
          <p>{actionError.message}</p>
          {actionError.hint ? <p className="mt-1 opacity-80">{actionError.hint}</p> : null}
        </Callout>
      ) : null}

      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={refresh}
        loadingRows={5}
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Stored predictions"
              value={stats.total ?? 0}
              icon={HistoryIcon}
              tone="brand"
              hint={stats.total ? `Showing up to ${number(limit)} most recent` : 'Nothing stored yet'}
            />
            <StatCard
              label="Mean confidence"
              value={percent(stats.mean_confidence)}
              icon={Sparkles}
              tone="violet"
              hint="Across every saved prediction"
            />
            <StatCard
              label="Distinct classes"
              value={stats.categories_used ?? 0}
              icon={Filter}
              tone="emerald"
              hint={
                Object.keys(stats.distribution ?? {}).length
                  ? Object.entries(stats.distribution)
                      .map(([label, count]) => `${label} ${number(count)}`)
                      .join(' · ')
                  : 'No classes seen yet'
              }
            />
            <StatCard
              label="Most common class"
              value={
                Object.entries(stats.distribution ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
              }
              icon={Info}
              tone="slate"
              decimals={0}
              hint="Across all saved predictions"
            />
          </div>

          <Card className="flex flex-col">
            <CardBody className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="field-label mb-2">Filter by class</p>
                <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} size="sm" />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="history-search" className="field-label mb-1.5">
                    Search
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="history-search"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Class, advice or a reading"
                      className="field w-full pr-3 pl-9 sm:w-64"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="history-limit" className="field-label mb-1.5">
                    Rows
                  </label>
                  <select
                    id="history-limit"
                    value={limit}
                    onChange={(event) => setLimit(Number(event.target.value))}
                    className="field w-auto py-1.5 text-xs"
                  >
                    {[50, 200, 1000].map((size) => (
                      <option key={size} value={size}>
                        Latest {number(size)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardBody>

            {!items.length ? (
              <EmptyState
                icon={Sparkles}
                title="No predictions saved yet"
                description="Predictions are stored locally when the 'save to history' option is ticked on the prediction page."
                action={
                  <Link to="/predict">
                    <Button variant="primary" icon={Sparkles}>
                      Make a prediction
                    </Button>
                  </Link>
                }
              />
            ) : !rows.length ? (
              <EmptyState
                compact
                icon={Search}
                title="Nothing matches that filter"
                description="Clear the class filter or the search box to see the rest."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilter('all')
                      setSearch('')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {rows.map((item) => {
                  const label = item.label ?? 'Unknown'
                  const meta = classMeta(label)
                  const confidence = Number(item.confidence) / 100

                  return (
                    <li key={item.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <span
                            className={cn('mt-1 size-2.5 shrink-0 rounded-full', meta.dot)}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {label}
                              </span>
                              <Badge className={meta.badge}>{meta.audience}</Badge>
                              <NeutralBadge title={item.created_at ?? item.timestamp}>
                                {relativeTime(item.created_at ?? item.timestamp)}
                              </NeutralBadge>
                            </div>

                            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                              {item.recommendation}
                            </p>

                            <details className="mt-2">
                              <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                Readings used
                              </summary>
                              <MetricGrid cols={4} className="mt-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                                {Object.entries(item.inputs ?? {}).map(([key, value]) => (
                                  <Metric key={key} label={key} value={decimal(value, 2)} />
                                ))}
                              </MetricGrid>
                            </details>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-32">
                            <div className="mb-1 flex items-baseline justify-between gap-2">
                              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                Confidence
                              </span>
                              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                {percent(item.confidence, 1)}
                              </span>
                            </div>
                            <ProgressBar
                              value={confidence}
                              max={1}
                              color={meta.color}
                              height="h-1.5"
                              label={`${label} confidence`}
                            />
                            <p className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                              {formatDate(item.created_at ?? item.timestamp)}
                            </p>
                          </div>
                          <IconButton
                            icon={Trash2}
                            label={`Delete prediction ${item.id}`}
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 dark:text-red-400"
                            onClick={() => setPendingDelete(item)}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Callout tone="info" title="Where this data lives">
            History is a local SQLite table on the server that ran the prediction — not an account, and
            not synced anywhere. Deleting a row here removes it permanently; batch predictions are not
            stored at all unless you download them.
          </Callout>
        </div>
      </AsyncBoundary>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this prediction?"
        description={
          pendingDelete
            ? `${pendingDelete.label} · ${decimal(pendingDelete.confidence, 1)}% confidence · ${relativeTime(
                pendingDelete.created_at ?? pendingDelete.timestamp,
              )}. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        loading={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      >
        {pendingDelete ? (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            <CircleX className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            The stored readings will be removed with it.
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all history?"
        description={`This permanently deletes all ${number(items.length)} stored predictions on this server. Export a CSV first if you want to keep a copy.`}
        confirmLabel="Delete everything"
        loading={busy}
        onCancel={() => setConfirmClear(false)}
        onConfirm={wipe}
      />
    </div>
  )
}
