/**
 * 404.
 *
 * Deliberately helpful rather than a dead end: it lists the real routes so a
 * mistyped URL still gets the reader somewhere useful.
 */
import { Link, useLocation } from 'react-router-dom'
import { Compass, House, MapPinOff } from 'lucide-react'

import { Card, CardBody, EmptyState } from '../components/UI.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { routesMeta } from '../routesMeta.js'

export default function NotFound() {
  useDocumentTitle('Page not found')
  const location = useLocation()

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-xl">
        <CardBody>
          <EmptyState
            icon={MapPinOff}
            title="That page does not exist"
            description={
              <>
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {location.pathname}
                </span>{' '}
                is not a route in this app. Nothing was lost — try one of these instead.
              </>
            }
          />

          <nav aria-label="All pages" className="border-t border-slate-200/80 pt-4 dark:border-slate-800">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {routesMeta.map((route) => (
                <li key={route.path}>
                  <Link
                    to={route.path}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                  >
                    {route.icon ? (
                      <route.icon className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Compass className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{route.label}</span>
                    {route.path === location.pathname ? (
                      <span className="ml-auto text-[10px] text-slate-400">(current)</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex justify-center">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-700"
              >
                <House className="size-4" aria-hidden="true" />
                Back to dashboard
              </Link>
            </div>
          </nav>
        </CardBody>
      </Card>
    </div>
  )
}
