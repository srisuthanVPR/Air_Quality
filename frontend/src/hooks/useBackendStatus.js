import { useCallback, useEffect, useRef, useState } from 'react'

import { checkHealth } from '../services/api'

/**
 * Polls `/api/health` and reports whether the backend is reachable.
 *
 * Powers the sidebar status pill and the app-wide offline banner. The first
 * check runs immediately; after that we back off from 10s to a 60s ceiling so
 * an absent backend costs a handful of cheap requests per minute rather than
 * one every second.
 */
export function useBackendStatus({ intervalMs = 15000 } = {}) {
  const [status, setStatus] = useState({
    online: false,
    checking: true,
    version: null,
    datasetAvailable: false,
    modelReady: false,
    model: null,
    error: null,
  })

  const timer = useRef(null)
  const backoff = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const check = useCallback(async () => {
    if (!mounted.current) return
    try {
      const data = await checkHealth()
      if (!mounted.current) return
      backoff.current = 0
      setStatus({
        online: true,
        checking: false,
        version: data.version ?? null,
        datasetAvailable: Boolean(data.dataset_available),
        modelReady: Boolean(data.model?.ready),
        model: data.model ?? null,
        error: null,
      })
    } catch (error) {
      if (!mounted.current) return
      // 503 means the server answered but the model is missing - the API is
      // up, so report online and let the UI explain the missing model.
      const serverResponded = error?.status > 0
      if (serverResponded) backoff.current = 0
      else backoff.current = Math.min(backoff.current + 1, 6)
      setStatus({
        online: serverResponded,
        checking: false,
        version: null,
        datasetAvailable: false,
        modelReady: false,
        model: null,
        error: serverResponded ? error : null,
      })
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      await check()
      if (cancelled || !mounted.current) return
      const delay = backoff.current === 0 ? intervalMs : intervalMs * backoff.current
      timer.current = setTimeout(tick, Math.min(delay, 60000))
    }

    tick()

    // A tab that was hidden for a while is stale the moment it is shown again.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !document.hidden) check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [check, intervalMs])

  return {
    ...status,
    /** Offline specifically because the server could not be reached. */
    offline: !status.checking && !status.online,
    recheck: check,
  }
}
