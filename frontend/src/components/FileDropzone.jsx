/**
 * Drag-and-drop file picker for batch prediction.
 *
 * Handles the two ways people actually select a file — clicking to browse and
 * dropping onto the panel — plus paste, and enforces the CSV-only rule before a
 * request is ever made.
 */
import { useCallback, useRef, useState } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'

import { cn } from '../utils/cn.js'
import { bytes } from '../utils/formatters.js'

const ACCEPTED = ['.csv', 'text/csv', 'application/csv', 'text/plain']

export function FileDropzone({
  onSelect,
  onClear,
  file,
  disabled = false,
  maxBytes = 25 * 1024 * 1024,
  hint,
  className,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState(null)
  // Nested elements fire dragleave as the pointer crosses them, so count
  // enter/leave events instead of toggling on the first one.
  const dragDepth = useRef(0)

  const validate = useCallback(
    (candidate) => {
      if (!candidate) return 'No file selected.'
      const looksCsv =
        ACCEPTED.includes(candidate.type) || candidate.name.toLowerCase().endsWith('.csv')
      if (!looksCsv) return 'Only CSV files are supported. Save your data as .csv and try again.'
      if (candidate.size === 0) return 'That file is empty.'
      if (candidate.size > maxBytes) {
        return `That file is ${bytes(candidate.size)}, which is above the ${bytes(maxBytes)} limit.`
      }
      return null
    },
    [maxBytes],
  )

  const accept = useCallback(
    (candidate) => {
      if (disabled) return
      const issue = validate(candidate)
      setProblem(issue)
      if (!issue) onSelect(candidate)
    },
    [disabled, onSelect, validate],
  )

  const onDrop = (event) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    accept(event.dataTransfer.files?.[0])
  }

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  if (file) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50',
          className,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400">
          <FileSpreadsheet className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-200" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {bytes(file.size)} · ready to process
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Remove selected file"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current = Math.max(dragDepth.current - 1, 0)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openPicker()
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Choose a CSV file or drop one here"
        aria-disabled={disabled}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all duration-200',
          disabled
            ? 'cursor-not-allowed border-slate-200 opacity-60 dark:border-slate-800'
            : dragging
              ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
              : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/40',
          problem && !dragging ? 'border-red-400 dark:border-red-500/70' : '',
        )}
      >
        <span
          className={cn(
            'grid size-12 place-items-center rounded-2xl transition-transform duration-200',
            dragging ? 'scale-110 bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
          )}
          aria-hidden="true"
        >
          <Upload className="size-6" />
        </span>

        <p className="mt-3.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          {dragging ? 'Drop your CSV here' : 'Drag a CSV file here'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          or <span className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400">browse your files</span>
        </p>
        <p className="mt-2.5 text-[11px] text-slate-400 dark:text-slate-500">
          {hint ?? `Comma-separated, up to ${bytes(maxBytes)}`}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          accept(event.target.files?.[0])
          // Reset so re-picking the same file fires `change` again.
          event.target.value = ''
        }}
      />

      {problem ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
