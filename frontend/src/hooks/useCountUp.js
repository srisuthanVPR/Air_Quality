import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 up to `value` on first render.
 *
 * Deliberately opt-in (`animate` prop on stat tiles) because a number that
 * spends 900ms visibly rolling is annoying on a page the user revisits often.
 * Respects `prefers-reduced-motion` by snapping straight to the final value.
 */
export function useCountUp(value, { duration = 900, decimals = 0, enabled = true } = {}) {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0
  const [display, setDisplay] = useState(enabled ? 0 : target)
  const frame = useRef(null)

  useEffect(() => {
    if (!enabled) {
      setDisplay(target)
      return undefined
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target)
      return undefined
    }

    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      // easeOutExpo: fast off the line, gentle settle.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(target * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [target, duration, enabled])

  return display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
