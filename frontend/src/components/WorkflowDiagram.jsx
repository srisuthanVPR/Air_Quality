/**
 * End-to-end pipeline diagram.
 *
 * Renders the `/api/model/workflow` steps as a vertical timeline. Written by
 * hand rather than with a diagram library so it stays responsive, uses the
 * theme tokens, and needs no extra dependency.
 */
import { ArrowRight } from 'lucide-react'

import { cn } from '../utils/cn.js'
import { Card } from './UI.jsx'

export function WorkflowDiagram({ steps = [], targetRule, featureGroups = [], className }) {
  if (!steps.length) return null

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <ol className="relative px-5 py-5">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1

          return (
            <li key={step.title ?? index} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Connector */}
              {!isLast ? (
                <span
                  className="absolute top-9 bottom-1 left-[15px] w-px bg-gradient-to-b from-brand-400/70 to-slate-200 dark:to-slate-700"
                  aria-hidden="true"
                />
              ) : null}

              {/* Numbered node */}
              <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 font-mono text-xs font-bold text-white shadow-sm">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {step.title}
                  {step.output ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <ArrowRight className="size-2.5" aria-hidden="true" />
                      {step.output}
                    </span>
                  ) : null}
                </h3>

                {step.body ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {step.body}
                  </p>
                ) : null}

                {Array.isArray(step.details) && step.details.length ? (
                  <ul className="mt-2.5 space-y-1">
                    {step.details.map((detail) => (
                      <li
                        key={detail.label ?? detail}
                        className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />
                        <span>
                          {detail.label ? <span className="font-semibold">{detail.label}: </span> : null}
                          {detail.description ?? detail.body ?? null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {targetRule || featureGroups.length ? (
        <div className="border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
          {targetRule ? (
            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Label derivation rule
              </p>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed break-words text-slate-600 dark:text-slate-300">
                {targetRule}
              </p>
            </div>
          ) : null}

          {featureGroups.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {featureGroups.map((group) => (
                <li
                  key={group.key ?? group.label}
                  className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {group.label}
                  <span className="font-mono opacity-70">
                    {group.features?.length ?? group.count ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
