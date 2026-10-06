/**
 * Shell for every authenticated page: sidebar + topbar + routed content.
 *
 * Also owns the app-wide offline banner, because a page that silently fails to
 * load its data is far more confusing than one that says "the API is down".
 */
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ServerCrash, X } from 'lucide-react'

import { Sidebar, SidebarDrawer } from '../components/Sidebar.jsx'
import { Topbar } from '../components/Topbar.jsx'
import { Button } from '../components/UI.jsx'
import { useBackendStatus } from '../hooks/useBackendStatus.js'
import { useIsMobile } from '../hooks/useApi.js'
import { PAGE_TITLES } from '../routesMeta.js'

/** Nudge the user back to the top on navigation, but not on filter changes. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export function AppLayout() {
  const location = useLocation()
  const status = useBackendStatus()
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Close the drawer whenever the route changes or the viewport grows.
  useEffect(() => setMenuOpen(false), [location.pathname])
  useEffect(() => {
    if (!isMobile) setMenuOpen(false)
  }, [isMobile])

  // Bring the banner back if the backend drops out again later.
  useEffect(() => {
    if (status.online) setBannerDismissed(false)
  }, [status.online])

  const title = PAGE_TITLES[location.pathname] ?? 'Dashboard'

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-950">
      <ScrollToTop />

      <Sidebar status={status} />
      <SidebarDrawer open={menuOpen} onClose={() => setMenuOpen(false)} status={status} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onOpenMenu={() => setMenuOpen(true)} status={status} />

        {status.offline && !bannerDismissed ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5 sm:px-6 dark:border-red-900/60 dark:bg-red-950/40"
          >
            <ServerCrash className="size-4 shrink-0 text-red-500" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-xs text-red-800 dark:text-red-200">
              <span className="font-bold">Backend unreachable.</span> Start it with{' '}
              <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-[11px] dark:bg-red-900/50">
                python -m backend.main
              </code>{' '}
              on port 8000, then retry.
            </p>
            <Button size="sm" variant="secondary" onClick={status.recheck}>
              Retry
            </Button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss offline notice"
              className="grid size-7 shrink-0 place-items-center rounded-lg text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[100rem]">
            <Outlet context={{ status }} />
          </div>
        </main>

        <footer className="border-t border-slate-200/80 px-4 py-4 text-center text-[11px] text-slate-400 sm:px-6 dark:border-slate-800 dark:text-slate-500">
          Air Quality Intelligence · trained on the UCI Air Quality (AirQualityUCI) dataset ·
          predictions are educational, not a health advisory
        </footer>
      </div>
    </div>
  )
}
