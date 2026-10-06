import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Runs an async API call and tracks loading / error / data state.
 *
 * Two behaviours worth knowing about:
 *
 *  1. **Stale responses are dropped.** Every request gets a sequence number;
 *     if a slower earlier request resolves after a newer one, its result is
 *     discarded. Without this, fast typing in the Dataset Explorer lets an old
 *     page overwrite the new one.
 *  2. **`immediate: false` defers the call**, so a page can control when the
 *     request fires (`useApi(fn, [], { immediate: false })` then `.run()`).
 */
export function useApi(fetcher, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(immediate)

  const mounted = useRef(true)
  const sequence = useRef(0)
  const lastArgs = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(
    async (...args) => {
      lastArgs.current = args
      const ticket = ++sequence.current
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher(...args)
        // A newer request has already started; throw this result away.
        if (!mounted.current || ticket !== sequence.current) return undefined
        setData(result)
        return result
      } catch (caught) {
        if (!mounted.current || ticket !== sequence.current) return undefined
        setError(caught)
        setData(initialData)
        return undefined
      } finally {
        if (mounted.current && ticket === sequence.current) setLoading(false)
      }
    },
    // `fetcher` is intentionally excluded: callers pass an inline arrow and we
    // do not want a new request on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...deps, initialData],
  )

  // Re-runs whenever the caller's deps change.
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    if (immediate) runRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const reset = useCallback(() => {
    sequence.current += 1 // invalidate any in-flight response
    setData(initialData)
    setError(null)
    setLoading(false)
  }, [initialData])

  return {
    data,
    error,
    loading,
    /** `true` while a request is in flight *and* no data is on screen yet. */
    initialLoading: loading && data === null && !error,
    run,
    reset,
    setData,
    /** Repeats the most recent call with the same arguments. */
    refresh: useCallback(() => runRef.current(...(lastArgs.current ?? [])), []),
  }
}

/**
 * Debounces a rapidly-changing value (search boxes, range sliders) so the
 * backend gets one request instead of fifteen.
 */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * Tracks a media query, e.g. `useMediaQuery('(min-width: 1024px)')`.
 * Used to drop chart axis labels on narrow screens instead of overlapping them.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True while the viewport is at or below the given breakpoint. */
export const useIsMobile = (maxWidth = 767) => useMediaQuery(`(max-width: ${maxWidth}px)`)

/** Locks body scroll while a modal or drawer is open. */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}

/**
 * Calls `handler` on Escape. Registered on `window` so it works regardless of
 * whether focus happens to be inside the dialog.
 */
export function useEscapeKey(handler, active = true) {
  useEffect(() => {
    if (!active) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handler(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handler, active])
}

/** Copies text to the clipboard and reports success for ~2 seconds. */
export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(String(text))
      } catch {
        // Clipboard API needs a secure context; fall back to the legacy path.
        const area = document.createElement('textarea')
        area.value = String(text)
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), timeout)
    },
    [timeout],
  )

  return { copied, copy }
}
