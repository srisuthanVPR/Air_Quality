/**
 * Display formatters.
 *
 * The single most important rule here: anything that arrives as `null`,
 * `undefined` or `NaN` renders as an em dash rather than "NaN" or
 * "Invalid Date". Every page leans on this so missing data never looks like a
 * bug in the app.
 */

export const EM_DASH = '—'

export const isMissing = (value) =>
  value === null || value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value))

/** Thousands-separated integer, or an em dash. */
export function number(value, fallback = EM_DASH) {
  if (isMissing(value)) return fallback
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** Fixed-decimal number with locale separators (e.g. `1,109.51`). */
export function decimal(value, digits = 2, fallback = EM_DASH) {
  if (isMissing(value)) return fallback
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Compact display for large counts: 9471 -> "9,471", 1_250_000 -> "1.3M".
 * `compact` switches on the K/M/B suffixes.
 */
export function count(value, { compact = false } = {}) {
  if (isMissing(value)) return EM_DASH
  const number_ = Number(value)
  if (!compact || Math.abs(number_) < 10000) return number(number_)
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number_)
}

/**
 * A 0-1 fraction (or 0-100 number) as a percentage string.
 * `0.9979 -> "99.8%"`, `99.79 -> "99.8%"`, `null -> "—"`.
 */
export function percent(value, digits = 1, fallback = EM_DASH) {
  if (isMissing(value)) return fallback
  const number_ = Number(value)
  if (!Number.isFinite(number_)) return fallback
  const fraction = number_ > 1 ? number_ / 100 : number_
  return `${(fraction * 100).toFixed(digits)}%`
}

/** Percentage with the unit already appended, for stat tiles. */
export const percentValue = (value, digits = 1) => {
  const text = percent(value, digits, null)
  return text === null ? null : text
}

/** Signed value, for deltas like feature importances. */
export function signed(value, digits = 3) {
  if (isMissing(value)) return EM_DASH
  const number_ = Number(value)
  const sign = number_ > 0 ? '+' : ''
  return `${sign}${number_.toFixed(digits)}`
}

// ------------------------------------------------------------------ dates ----

/**
 * Parses a value from the API. The backend sends ISO strings, but SQLite
 * history rows and CSV rows can hand us a `Date`/`Time` pair instead.
 */
export function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (isMissing(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value, { withTime = true } = {}) {
  const date = parseDate(value)
  if (!date) return EM_DASH
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  })
}

export function formatDateOnly(value) {
  return formatDate(value, { withTime: false })
}

/** `2024-03-05` for `<input type="date">` value attributes. */
export function toDateInput(value) {
  const date = parseDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function fromDateInput(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** "3 minutes ago" / "2 days ago", falling back to an absolute date past a week. */
export function relativeTime(value) {
  const date = parseDate(value)
  if (!date) return EM_DASH

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 0) return formatDate(date)
  if (seconds < 60) return 'just now'

  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
  ]
  for (const [unit, size] of units) {
    // Each unit owns the range up to the next one, so stop at the first match.
    if (seconds < size * 60) {
      const amount = Math.floor(seconds / size)
      return `${amount} ${unit}${amount === 1 ? '' : 's'} ago`
    }
  }
  return formatDate(date)
}

// ------------------------------------------------------------------ bytes ----

export function bytes(value) {
  if (isMissing(value)) return EM_DASH
  let size = Number(value)
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

// ------------------------------------------------------------------ misc -----

/** Renders an ISO timestamp as a short, human label for charts. */
export function shortDate(value) {
  const date = parseDate(value)
  if (!date) return EM_DASH
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function shortDateTime(value) {
  const date = parseDate(value)
  if (!date) return EM_DASH
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Trims a long string for table cells. */
export function truncate(text, max = 60) {
  if (isMissing(text)) return EM_DASH
  const string_ = String(text)
  return string_.length > max ? `${string_.slice(0, max - 1)}…` : string_
}

/** Lowercase with underscores turned into spaces, e.g. "not_relevant" -> "not relevant". */
export function humanize(text) {
  if (isMissing(text)) return EM_DASH
  return String(text)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Pluralises a noun against a count: `plural(1,'row')` -> "1 row". */
export function plural(count_, singular, plural_ = `${singular}s`) {
  return `${number(count_)} ${count_ === 1 ? singular : plural_}`
}

/** Builds a stable, readable page title. */
export function pageTitle(text) {
  return text ? `${text} · Air Quality Intelligence` : 'Air Quality Intelligence'
}
