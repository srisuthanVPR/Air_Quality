/**
 * Air-quality presentation helpers.
 *
 * Colour and label definitions are duplicated from the backend
 * (`backend/ml/config.py`) on purpose: the UI must render instantly from the
 * data it already has, without waiting on a request just to learn what colour
 * "Unhealthy" is. The backend remains the source of truth and sends the same
 * hex values in `/api/predict/classes`, which `colorFor` prefers when present.
 */

/** Ordered worst -> best, matching `CLASS_ORDER` on the backend. */
export const CLASS_ORDER = ['Good', 'Moderate', 'Unhealthy', 'Very Unhealthy']

export const CLASS_META = {
  Good: {
    id: 0,
    color: '#10b981',
    short: 'Good',
    tailwind: 'emerald',
    // Text + soft background + border, for light and dark mode.
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-400/25',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    gradient: 'from-emerald-500 to-teal-500',
    audience: 'Everyone',
  },
  Moderate: {
    id: 1,
    color: '#f59e0b',
    short: 'Moderate',
    tailwind: 'amber',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/12 dark:text-amber-300 dark:ring-amber-400/25',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
    gradient: 'from-amber-500 to-orange-500',
    audience: 'Sensitive groups',
  },
  Unhealthy: {
    id: 2,
    color: '#f97316',
    short: 'Unhealthy',
    tailwind: 'orange',
    badge: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/12 dark:text-orange-300 dark:ring-orange-400/25',
    bar: 'bg-orange-500',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500',
    gradient: 'from-orange-500 to-red-500',
    audience: 'Sensitive groups',
  },
  'Very Unhealthy': {
    id: 3,
    color: '#ef4444',
    short: 'Very Unhealthy',
    tailwind: 'red',
    badge: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/12 dark:text-red-300 dark:ring-red-400/25',
    bar: 'bg-red-500',
    dot: 'bg-red-500',
    ring: 'ring-red-500',
    gradient: 'from-red-500 to-rose-600',
    audience: 'Everyone',
  },
}

const FALLBACK = {
  color: '#64748b',
  badge: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-500/12 dark:text-slate-300',
  bar: 'bg-slate-400',
  dot: 'bg-slate-400',
  ring: 'ring-slate-400',
  gradient: 'from-slate-400 to-slate-500',
  audience: 'Unknown',
}

/** Presentation metadata for a category name. Never throws on unknown input. */
export function classMeta(name) {
  if (!name) return FALLBACK
  return CLASS_META[name] ?? { ...FALLBACK, short: String(name), tailwind: 'slate' }
}

export const badgeClasses = (name) => classMeta(name).badge
export const barClasses = (name) => classMeta(name).bar
export const dotClasses = (name) => classMeta(name).dot

/** Hex colour, preferring the value the backend sent when available. */
export function colorFor(name, fromApi) {
  return fromApi || classMeta(name).color
}

/**
 * Confidence bar colour. High confidence in a clean-looking model is a bad
 * thing to show as pure green, so only the low end is tinted as a warning.
 */
export function confidenceColor(confidence) {
  if (confidence >= 75) return '#10b981'
  if (confidence >= 50) return '#f59e0b'
  return '#ef4444'
}

/** One-line plain-English advice, keyed by category. */
export const RECOMMENDATIONS = {
  Good:
    'Outdoor activity is fine for everyone. A good moment for exercise, cycling or opening windows.',
  Moderate:
    'Fine for most people. Unusually sensitive individuals should consider limiting long outdoor exertion.',
  Unhealthy:
    'Sensitive groups should reduce prolonged or heavy outdoor exertion. Everyone else may notice symptoms.',
  'Very Unhealthy':
    'Avoid prolonged outdoor exertion. Keep windows closed on high-pollution days and use filtered air indoors.',
}

/** Relative severity as a 0-1 score, used for ordering and bar widths. */
export function severityScore(name) {
  const index = CLASS_ORDER.indexOf(name)
  if (index < 0) return 0
  return index / (CLASS_ORDER.length - 1)
}

/**
 * Accuracy-like values arrive as 0-1 fractions from the API but are shown as
 * percentages. Accepts either form so a stray `99` still renders sensibly.
 * Returns a number (not a string) so callers can format it themselves.
 */
export function asPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const fraction = number > 1 ? number / 100 : number
  return fraction * 100
}
