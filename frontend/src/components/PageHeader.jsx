/**
 * Page heading with an optional description, action slot and breadcrumb.
 * Every route renders one of these so page rhythm stays consistent.
 */
import { Link } from 'react-router-dom'

import { cn } from '../utils/cn.js'

export function PageHeader({ title, description, action, breadcrumb, icon: Icon, className }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumb?.length ? (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {breadcrumb.map((crumb, index) => {
                const isLast = index === breadcrumb.length - 1
                return (
                  <li key={crumb.label} className="flex items-center gap-1.5">
                    {crumb.to && !isLast ? (
                      <Link
                        to={crumb.to}
                        className="rounded transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'text-slate-700 dark:text-slate-200' : undefined}>
                        {crumb.label}
                      </span>
                    )}
                    {!isLast ? <span aria-hidden="true">/</span> : null}
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : null}

        <h1 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
          {Icon ? <Icon className="size-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" /> : null}
          <span className="truncate">{title}</span>
        </h1>

        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  )
}
