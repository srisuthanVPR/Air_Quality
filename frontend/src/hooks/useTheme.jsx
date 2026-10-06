import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'aq-theme'

/** Reads the stored preference, falling back to the OS setting. */
function initialTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* localStorage can be blocked in private mode - fall through */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Class-based dark mode.
 *
 * The `dark` class is toggled on `<html>` (not on a wrapper) because
 * `index.css` defines `@custom-variant dark (&:where(.dark, .dark *))`, so every
 * `dark:` utility in the tree depends on an ancestor carrying that class.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme

    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* persistence is a nicety, not a requirement */
    }
  }, [theme])

  // Follow the OS only while the user has not made an explicit choice.
  useEffect(() => {
    let stored = null
    try {
      stored = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return undefined
    }
    if (stored) return undefined

    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => setTheme(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const set = useCallback((next) => {
    if (next === 'light' || next === 'dark') setTheme(next)
  }, [])

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', toggle, setTheme: set }),
    [theme, toggle, set],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.')
  return context
}
