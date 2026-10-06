/**
 * Public shell for the landing page: sticky header, content, rich footer.
 * Deliberately shares nothing with `AppLayout` beyond the theme and nav config
 * so the marketing page can have its own visual weight.
 */
import { Link } from 'react-router-dom'
import { Database, ExternalLink, Menu, Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'

import { Logo } from '../components/Sidebar.jsx'
import { Button, IconButton } from '../components/UI.jsx'
import { useTheme } from '../hooks/useTheme.jsx'

const HEADER_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/predict', label: 'Predict' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/model', label: 'Model' },
]

export function PublicLayout({ children }) {
  const { isDark, toggle } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <header className="glass sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Air Quality Intelligence home">
            <Logo />
          </Link>

          <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 md:flex">
            {HEADER_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <IconButton
              icon={isDark ? Sun : Moon}
              label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggle}
            />
            <Link to="/dashboard" className="hidden sm:block">
              <Button variant="primary" size="sm">
                Open app
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              className="grid size-9 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {open ? (
          <nav
            aria-label="Mobile"
            className="border-t border-slate-200/80 px-4 py-3 md:hidden dark:border-slate-800"
          >
            <ul className="space-y-0.5">
              {HEADER_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Logo />
              <p className="mt-3.5 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                A Random Forest classifier over the UCI Air Quality dataset, wrapped in a FastAPI
                service and a React dashboard — with every metric shown as measured rather than
                asserted.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                Application
              </p>
              <ul className="mt-3 space-y-2">
                {HEADER_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-slate-600 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                Reference
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a
                    href="https://archive.ics.uci.edu/dataset/360/air+quality"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    <Database className="size-3.5" aria-hidden="true" />
                    UCI Air Quality dataset
                    <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="transition-colors hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    Methodology &amp; caveats
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-slate-200/80 pt-6 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-400">
            <p>
              Built for demonstration and education. Predictions are not a substitute for official
              air quality monitoring.
            </p>
            <p className="font-mono">AirQualityUCI · 9,471 readings · 2004–2005</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
