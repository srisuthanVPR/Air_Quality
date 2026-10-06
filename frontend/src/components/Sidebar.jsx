/**
 * Application navigation.
 *
 * Two visual states: a fixed rail on `xl` and up, and an off-canvas drawer
 * below that. Grouped into "Analyse" and "Explore" so the ten routes read as a
 * small number of intentions rather than a flat list.
 */
import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  ChartColumnBig,
  FlaskConical,
  Gauge,
  History,
  Layers,
  LineChart,
  Sparkles,
  Table2,
  Upload,
  X,
} from 'lucide-react'

import { cn } from '../utils/cn.js'

export const NAV_GROUPS = [
  {
    label: 'Analyse',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Gauge, end: true },
      { to: '/predict', label: 'Predict', icon: Sparkles },
      { to: '/batch', label: 'Batch CSV', icon: Upload },
      { to: '/history', label: 'History', icon: History },
    ],
  },
  {
    label: 'Explore',
    items: [
      { to: '/analytics', label: 'Analytics', icon: LineChart },
      { to: '/dataset', label: 'Dataset', icon: Table2 },
      { to: '/model', label: 'Model', icon: Layers },
    ],
  },
]

export const NAV_FOOTER = [{ to: '/about', label: 'About', icon: BookOpen }]

/** Brand mark: a stylised air-quality gauge. */
export function Logo({ className, showWordmark = true }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-sm">
        <ChartColumnBig className="size-5 text-white" aria-hidden="true" />
      </span>
      {showWordmark ? (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
            Air Quality
          </span>
          <span className="block text-[10px] font-bold tracking-[0.18em] text-brand-600 uppercase dark:text-brand-400">
            Intelligence
          </span>
        </span>
      ) : null}
    </span>
  )
}

function NavItems({ onNavigate, status }) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase dark:text-slate-500">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-500 transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden="true"
                      />
                      <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {item.to === '/predict' && status?.modelReady ? (
                        <FlaskConical
                          className="size-3.5 shrink-0 text-emerald-500"
                          aria-label="Model ready"
                        />
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

/** Shared sidebar body, used by both the rail and the drawer. */
function SidebarBody({ onNavigate, status, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4">
        <NavLink to="/dashboard" onClick={onNavigate} aria-label="Air Quality Intelligence home">
          <Logo />
        </NavLink>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-4">
        <NavItems onNavigate={onNavigate} status={status} />
      </nav>

      <div className="border-t border-slate-200/80 px-3 py-3 dark:border-slate-800">
        <ul className="mb-3 space-y-0.5">
          {NAV_FOOTER.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
              >
                <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <StatusCard status={status} />
      </div>
    </div>
  )
}

/** Backend reachability + model state, always visible at the bottom of the rail. */
function StatusCard({ status }) {
  const online = status?.online
  const modelReady = status?.modelReady

  const dotColor = !online ? '#ef4444' : modelReady ? '#10b981' : '#f59e0b'
  const headline = !online
    ? 'Backend offline'
    : status?.checking
      ? 'Checking…'
      : modelReady
        ? 'All systems ready'
        : 'Model not loaded'

  const detail = !online
    ? 'Start the API on port 8000'
    : modelReady
      ? `${status.version ?? 'API'} · model loaded`
      : 'Run python -m backend.ml.train'

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="flex items-center gap-2">
        <span className="relative inline-flex size-2 shrink-0">
          {online ? (
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: dotColor }}
              aria-hidden="true"
            />
          ) : null}
          <span
            className="relative inline-flex size-2 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden="true"
          />
        </span>
        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{headline}</p>
      </div>
      <p className="mt-1 font-mono text-[10px] leading-relaxed break-words text-slate-500 dark:text-slate-400">
        {detail}
      </p>
    </div>
  )
}

/** Fixed rail for `xl` and wider. */
export function Sidebar({ status }) {
  return (
    <aside className="glass hidden w-64 shrink-0 border-r border-slate-200/80 xl:block dark:border-slate-800">
      <div className="sticky top-0 h-dvh">
        <SidebarBody status={status} />
      </div>
    </aside>
  )
}

/** Off-canvas drawer for smaller viewports. */
export function SidebarDrawer({ open, onClose, status }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="absolute inset-y-0 left-0 w-72 animate-[fade-up_0.2s_ease-out] border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <SidebarBody onNavigate={onClose} onClose={onClose} status={status} />
      </div>
    </div>
  )
}

export { StatusCard }
