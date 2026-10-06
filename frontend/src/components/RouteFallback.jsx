/**
 * Suspense fallback for lazily-loaded route chunks.
 *
 * Shown while a page module downloads, and full-screen (for the landing page,
 * which renders outside `AppLayout`) or inline otherwise.
 */
import { ChartColumnBig } from 'lucide-react'

import { cn } from '../utils/cn.js'
import { Logo } from './Sidebar.jsx'

export default function LoadingState({ label = 'Loading', fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-5">
          <Logo showWordmark={false} />
          <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
            <span className="spinner" aria-hidden="true" />
            <span className="text-sm font-semibold">{label}…</span>
          </div>
          <span className="sr-only" role="status">
            {label}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}
    >
      <ChartColumnBig className="size-7 text-brand-500/50" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}…</p>
      <span className="sr-only">{label}</span>
    </div>
  )
}
