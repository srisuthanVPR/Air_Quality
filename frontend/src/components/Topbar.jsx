/**
 * Sticky application header: mobile menu trigger, page title, theme toggle,
 * backend status and a link back to the landing page.
 */
import { Link } from 'react-router-dom'
import { Menu, Moon, Sun, Wifi, WifiOff } from 'lucide-react'

import { cn } from '../utils/cn.js'
import { useTheme } from '../hooks/useTheme.jsx'
import { IconButton } from './UI.jsx'

export function Topbar({ title, onOpenMenu, status }) {
  const { isDark, toggle } = useTheme()

  return (
    <header className="glass sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 xl:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 sm:text-base dark:text-white">
          {title}
        </h1>

        <BackendPill status={status} />

        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggle}
        />

        <Link
          to="/"
          className="hidden shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 sm:block dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
        >
          Home
        </Link>
      </div>
    </header>
  )
}

/** Compact online/offline indicator for the header. */
function BackendPill({ status }) {
  const checking = status?.checking
  const online = status?.online

  return (
    <span
      title={
        online
          ? `Backend reachable${status.version ? ` (v${status.version})` : ''}`
          : 'Backend is not reachable on the configured API URL'
      }
      className={cn(
        'hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold sm:inline-flex',
        online
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-400'
          : 'bg-red-50 text-red-700 dark:bg-red-500/12 dark:text-red-400',
      )}
    >
      {online ? (
        <Wifi className="size-3.5" aria-hidden="true" />
      ) : (
        <WifiOff className="size-3.5" aria-hidden="true" />
      )}
      {checking ? 'Checking' : online ? 'Online' : 'Offline'}
    </span>
  )
}
