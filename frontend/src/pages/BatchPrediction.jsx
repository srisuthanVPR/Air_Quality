/**
 * Batch CSV prediction.
 *
 * Upload → validate → score → preview → download. The results are held by the
 * backend in a temporary job keyed by `job_id`, so the download works from a
 * URL and the browser never has to hold the whole result set in memory.
 */
import { useCallback, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Info,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts'

import { FileDropzone } from '../components/FileDropzone.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { ChartCard, ChartTooltip } from '../components/charts/ChartCard.jsx'
import { useChartAnimation, useChartTheme } from '../components/charts/chartTheme.jsx'
import {
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
import {
  batchPredict,
  downloadBatch,
  getSampleCsvUrl,
  getTemplateColumns,
} from '../services/api.js'
import { classMeta } from '../utils/aqi.js'
import { cn } from '../utils/cn.js'
import { number, percent } from '../utils/formatters.js'

export default function BatchPrediction() {
  useDocumentTitle('Batch CSV')

  const template = useApi(getTemplateColumns, [])
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const resultRef = useRef(null)

  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const anim = useChartAnimation()

  const run = useCallback(async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const response = await batchPredict(file)
      setResult(response)
      // Bring the outcome into view on small screens.
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }))
    } catch (caught) {
      setError(caught)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }, [file])

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setConfirmClear(false)
  }

  const handleDownload = async () => {
    if (!result) return
    setDownloading(true)
    try {
      const stem = (file?.name ?? 'predictions').replace(/\.csv$/i, '')
      await downloadBatch(result.job_id, `${stem}_predictions.csv`)
    } catch (caught) {
      setError(caught)
    } finally {
      setDownloading(false)
    }
  }

  const required = template.data?.required_columns ?? []
  const notes = template.data?.notes ?? []
  const total = result?.total ?? 0
  const clean = result?.successful ?? 0
  const imputed = result?.imputed ?? 0
  const failed = result?.failed ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Batch CSV prediction"
        description="Score an entire file of hourly readings in one pass, then download the classes and probabilities."
        icon={Upload}
        action={
          result ? (
            <>
              <Button variant="secondary" icon={RotateCcw} onClick={() => setConfirmClear(true)}>
                Start over
              </Button>
              <Button
                variant="primary"
                icon={FileDown}
                onClick={handleDownload}
                loading={downloading}
              >
                Download CSV
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {/* ------------------------------------------------------ upload side */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="space-y-4">
              <FileDropzone
                file={file}
                onSelect={(next) => {
                  setFile(next)
                  setResult(null)
                  setError(null)
                }}
                onClear={() => {
                  setFile(null)
                  setResult(null)
                  setError(null)
                }}
                disabled={busy}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon={FileUp}
                  onClick={run}
                  loading={busy}
                  disabled={!file}
                  className="flex-1"
                >
                  {busy ? 'Processing…' : 'Run prediction'}
                </Button>
                {file ? (
                  <Button variant="ghost" onClick={reset} disabled={busy}>
                    Clear
                  </Button>
                ) : null}
              </div>

              {busy ? <ProcessingNote /> : null}
            </CardBody>
          </Card>

          {error ? (
            <Callout tone="danger" icon={CircleAlert} title="Upload rejected">
              <p>{error.message}</p>
              {error.hint ? <p className="mt-1 opacity-80">{error.hint}</p> : null}
            </Callout>
          ) : null}

          {/* Format requirements */}
          <Card>
            <div className="flex items-center gap-2.5 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800">
              <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Info className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">File format</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  What your CSV needs to contain
                </p>
              </div>
            </div>

            <CardBody className="space-y-3.5">
              <div>
                <p className="field-label mb-1.5">Required columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {required.map((name) => (
                    <code
                      key={name}
                      className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700 dark:bg-brand-500/12 dark:text-brand-400"
                    >
                      {name}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <p className="field-label mb-1.5">Also accepted</p>
                <div className="flex flex-wrap gap-1.5">
                  {(template.data?.optional_columns ?? []).map((name) => (
                    <code
                      key={name}
                      className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {name}
                    </code>
                  ))}
                </div>
              </div>

              {notes.length ? (
                <ul className="space-y-1 border-t border-slate-200/80 pt-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {notes.map((note) => (
                    <li key={note}>· {note}</li>
                  ))}
                </ul>
              ) : null}

              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                className="w-full"
                onClick={() => {
                  window.open(getSampleCsvUrl(), '_blank')
                }}
              >
                Download a ready-made sample
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* ------------------------------------------------------ result side */}
        <div ref={resultRef} className="flex flex-col gap-4">
          {result ? (
            <>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {result.filename ?? 'Results'}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {number(total)} rows scored · mean confidence {percent(result.mean_confidence)}
                    </p>
                  </div>
                  <Badge
                    className={
                      clean === total
                        ? classMeta('Good').badge
                        : failed > 0
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300'
                          : 'bg-sky-50 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300'
                    }
                    dot
                  >
                    {clean === total ? 'All rows clean' : `${number(clean)} clean`}
                  </Badge>
                </div>

                <CardBody className="space-y-4">
                  {/* Row accounting */}
                  <div className="grid grid-cols-3 gap-3">
                    <CountTile label="Clean" value={clean} tone="emerald" />
                    <CountTile label="Imputed" value={imputed} tone="sky" />
                    <CountTile label="Rejected" value={failed} tone="red" />
                  </div>

                  <ProgressBar value={clean} max={Math.max(total, 1)} color="#10b981" />

                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Clean</span> means
                    every value was usable as supplied.{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Imputed</span> means a
                    cell was blank or the -200 sentinel, so the training median filled it. Rows still get a
                    class, but the prediction is softer.{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Rejected</span> means a
                    cell held text or an impossible value — usually a data-entry mistake.
                  </p>

                  {result.problem_rows?.length ? (
                    <Callout tone="warning" title={`Problem rows: ${result.problem_rows.slice(0, 12).join(', ')}${result.problem_rows.length > 12 ? '…' : ''}`}>
                      Line numbers are 1-based and include the header. Each entry flags the first problem
                      found in that row.
                    </Callout>
                  ) : null}
                </CardBody>
              </Card>

              {/* Distribution */}
              <ChartCard
                title="Predicted class distribution"
                subtitle={`How the ${number(total)} rows split across air quality bands.`}
                height={isMobile ? 220 : 260}
                isEmpty={!Object.keys(result.distribution ?? {}).length}
              >
                <BarChart
                  data={Object.entries(result.distribution ?? {}).map(([label, count]) => ({
                    label,
                    count,
                    color: classMeta(label).color,
                  }))}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                >
                  <CartesianGrid {...theme.gridProps} />
                  <XAxis dataKey="label" {...theme.xAxisProps} />
                  <YAxis {...theme.yAxisProps} allowDecimals={false} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(value) => `${number(value)} rows`}
                        showTotal={false}
                      />
                    }
                  />
                  <Bar dataKey="count" name="Rows" radius={[4, 4, 0, 0]} {...anim}>
                    {Object.entries(result.distribution ?? {}).map(([label]) => (
                      <Cell key={label} fill={classMeta(label).color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartCard>

              {/* Preview */}
              <Card>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Result preview</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      First {result.preview?.length ?? 0} rows · full set in the download
                    </p>
                  </div>
                  <Button size="sm" variant="primary" icon={FileDown} onClick={handleDownload} loading={downloading}>
                    Download
                  </Button>
                </div>

                <div className="table-shell m-0 rounded-none border-0">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/40">
                      <tr>
                        {(result.columns ?? []).map((column) => (
                          <th key={column} scope="col" className="th whitespace-nowrap">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                      {(result.preview ?? []).map((row, rowIndex) => (
                        <tr key={rowIndex} className="tr-hover">
                          {(result.columns ?? []).map((column) => {
                            const value = row[column]
                            const isLabel = column === 'AQ_Category' || column === 'Air_Quality'
                            return (
                              <td
                                key={column}
                                className={cn(
                                  'td whitespace-nowrap font-mono text-xs',
                                  isLabel && 'font-bold',
                                )}
                              >
                                {value === null || value === undefined || value === '' ? (
                                  <span className="text-slate-300 dark:text-slate-600">—</span>
                                ) : isLabel ? (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={cn('size-1.5 rounded-full', classMeta(value).dot)}
                                      aria-hidden="true"
                                    />
                                    {String(value)}
                                  </span>
                                ) : (
                                  value
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState
                icon={FileSpreadsheet}
                title="No batch results yet"
                description="Choose a CSV, run the prediction and the class distribution plus a row preview will appear here."
              />
            </Card>
          )}
        </div>
      </div>

      {confirmClear ? (
        <ClearDialog
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            reset()
            setConfirmClear(false)
          }}
        />
      ) : null}
    </div>
  )
}

function CountTile({ label, value, tone }) {
  const tones = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    sky: 'text-sky-600 dark:text-sky-400',
    red: 'text-red-600 dark:text-red-400',
  }
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
      <p className={cn('font-mono text-xl font-bold', tones[tone])}>{number(value)}</p>
      <p className="mt-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </p>
    </div>
  )
}

/** Shown while a large upload is being scored. */
function ProcessingNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-sky-50 p-3.5 dark:bg-sky-950/30">
      <CircleCheck className="mt-px size-4 shrink-0 text-sky-500" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-sky-900 dark:text-sky-200">
        Reading the file, imputing any gaps and scoring every row. Large files can take a few seconds.
      </p>
    </div>
  )
}

/** Lightweight inline confirm — cheaper than a modal for a single reset. */
function ClearDialog({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-sm animate-[scale-in_0.2s_cubic-bezier(0.22,1,0.36,1)] p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Discard this batch?</h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          The results and the selected file will be cleared. Anything already downloaded stays on your
          machine.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Keep
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  )
}

