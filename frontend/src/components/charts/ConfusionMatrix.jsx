/**
 * Confusion matrix.
 *
 * Rows are the true class, columns the predicted class. Diagonal cells are
 * correct, so they carry the status colour while off-diagonal cells are tinted
 * by severity in proportion to how much mass they hold.
 */
import { Info } from 'lucide-react'

import { cn } from '../../utils/cn.js'
import { classMeta } from '../../utils/aqi.js'
import { number } from '../../utils/formatters.js'
import { Card } from '../UI.jsx'

export function ConfusionMatrix({
  labels = [],
  matrix = [],
  normalized = false,
  title = 'Confusion matrix',
  subtitle,
  className,
}) {
  if (!labels.length || !matrix.length) return null

  const grandTotal = matrix.flat().reduce((sum, value) => sum + (Number(value) || 0), 0) || 1

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>

      <div className="scroll-fade-x px-3 pb-3">
        <table className="w-full min-w-72 border-separate border-spacing-1 text-center">
          <caption className="sr-only">
            Rows are the actual class, columns are the predicted class.
          </caption>
          <thead>
            <tr>
              <th className="w-24" scope="col">
                <span className="sr-only">Actual \ Predicted</span>
              </th>
              {labels.map((label) => (
                <th key={`h-${label}`} scope="col" className="p-1">
                  <span
                    className="block truncate text-[10px] font-bold text-slate-500 dark:text-slate-400"
                    title={label}
                  >
                    {label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => {
              const trueLabel = labels[rowIndex] ?? `Class ${rowIndex}`
              const rowTotal = row.reduce((sum, value) => sum + (Number(value) || 0), 0) || 1
              const rowAccuracy = (Number(row[rowIndex]) || 0) / rowTotal

              return (
                <tr key={`r-${trueLabel}`}>
                  <th
                    scope="row"
                    className="p-1 text-right text-[10px] font-bold whitespace-nowrap text-slate-500 dark:text-slate-400"
                  >
                    {trueLabel}
                    <span className="ml-1 font-mono text-[9px] font-normal text-slate-400 dark:text-slate-500">
                      {Math.round(rowAccuracy * 100)}%
                    </span>
                  </th>

                  {row.map((rawValue, columnIndex) => {
                    const value = Number(rawValue) || 0
                    const isDiagonal = rowIndex === columnIndex
                    const share = value / rowTotal
                    const predictedLabel = labels[columnIndex] ?? `Class ${columnIndex}`
                    const meta = classMeta(predictedLabel)

                    return (
                      <td key={`c-${rowIndex}-${columnIndex}`} className="p-0">
                        <div
                          title={`Actual ${trueLabel} predicted as ${predictedLabel}: ${number(value)}${
                            normalized ? ` (${Math.round(share * 100)}% of actual)` : ''
                          }`}
                          className={cn(
                            'grid h-11 place-items-center rounded-lg font-mono text-xs font-bold transition-transform duration-150 hover:scale-105',
                            isDiagonal ? 'text-white' : 'text-slate-700 dark:text-slate-200',
                            value === 0 && 'bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-600',
                          )}
                          style={
                            value === 0
                              ? undefined
                              : {
                                  backgroundColor: isDiagonal
                                    ? `color-mix(in srgb, ${meta.color} ${Math.round(
                                        55 + share * 45,
                                      )}%, transparent)`
                                    : `color-mix(in srgb, #ef4444 ${Math.round(
                                        12 + share * 130,
                                      )}%, transparent)`,
                                }
                          }
                        >
                          {normalized ? `${Math.round(share * 100)}%` : number(value)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-3 dark:border-slate-800">
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>
            Diagonal cells are correct predictions. {number(grandTotal)} held-out readings were
            scored using this matrix.
          </span>
        </p>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Correct
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-red-400" aria-hidden="true" /> Misclassified
          </span>
        </div>
      </div>
    </Card>
  )
}
