/**
 * Single HTTP client for the whole app.
 *
 * Responsibilities:
 *  - resolve the base URL from `VITE_API_URL` (falls back to the dev proxy)
 *  - unwrap the backend's `{ error: { code, message, hint, fields } }` envelope
 *    into a readable `Error` so no page ever renders a raw HTTP status
 *  - treat a network failure as "Backend: Offline"
 */

const RAW_BASE = import.meta.env.VITE_API_URL ?? ''
export const API_BASE = RAW_BASE.replace(/\/+$/, '')
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT ?? 45000)

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'unknown', hint = null, fields = [] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.hint = hint
    this.fields = fields
  }

  /** True when the request never reached the server. */
  get isOffline() {
    return this.code === 'network_error'
  }
}

/** Network-level failure - no HTTP response was received. */
function offlineError(message) {
  return new ApiError(message || 'Backend server is unavailable.', {
    status: 0,
    code: 'network_error',
    hint: 'Make sure the FastAPI server is running on port 8000, then try again.',
  })
}

function parseBody(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json()
  return response.text().then((text) => ({ detail: text }))
}

async function request(path, { method = 'GET', body, signal, raw = false, timeout } = {}) {
  const url = `${API_BASE}/api${path}`

  let response
  try {
    response = await fetch(url, {
      method,
      signal: signal ?? AbortSignal.timeout(timeout ?? TIMEOUT_MS),
      headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ApiError('The request timed out.', {
        status: 0,
        code: 'timeout',
        hint: 'The server took too long to respond. Try again in a moment.',
      })
    }
    throw offlineError()
  }

  if (raw) {
    if (!response.ok) throw await toError(response)
    return response
  }

  if (!response.ok) throw await toError(response)
  if (response.status === 204) return null
  return parseBody(response)
}

async function toError(response) {
  let payload = null
  try {
    payload = await parseBody(response)
  } catch {
    payload = null
  }

  // Preferred shape: our own error envelope.
  const envelope = payload?.error
  if (envelope) {
    return new ApiError(envelope.message || 'The request failed.', {
      status: response.status,
      code: envelope.code || 'api_error',
      hint: envelope.hint,
      fields: envelope.fields || [],
    })
  }

  // FastAPI's own validation shape.
  if (Array.isArray(payload?.detail)) {
    const fields = payload.detail.map((item) => ({
      feature: String(item.loc?.at(-1) ?? 'request'),
      message: String(item.msg ?? 'invalid value'),
    }))
    return new ApiError(fields[0]?.message || 'The request could not be validated.', {
      status: response.status,
      code: 'validation_error',
      hint: 'Check the highlighted values and try again.',
      fields,
    })
  }

  const fallback = {
    404: 'That resource could not be found.',
    405: 'That action is not allowed here.',
    413: 'The file is too large to process.',
    429: 'Too many requests - please wait a moment.',
    500: 'The server hit an unexpected problem.',
    503: 'The service is temporarily unavailable.',
  }[response.status]

  const message =
    (typeof payload?.detail === 'string' && payload.detail) || fallback || 'The request failed.'

  return new ApiError(message, {
    status: response.status,
    code: response.status === 503 ? 'service_unavailable' : 'api_error',
    hint:
      response.status >= 500
        ? 'This is a server-side problem. Check the backend logs if it persists.'
        : null,
  })
}

const query = (params) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const string = search.toString()
  return string ? `?${string}` : ''
}

// ---------------------------------------------------------------- system ----
export const checkHealth = (options) => request('/health', options)

export const getApiIndex = (options) => request('', options)

// -------------------------------------------------------------- dashboard ---
export const getDashboard = (options) => request('/dashboard', options)

// ------------------------------------------------------------- prediction ---
/** `readings` is keyed by real column name, e.g. `{ 'CO(GT)': 2.6, T: 13.6 }`. */
export const predict = (readings, { save = true, signal } = {}) =>
  request(`/predict?save=${save}`, { method: 'POST', body: readings, signal })

export const getClasses = (options) => request('/predict/classes', options)

export const getTemplateColumns = (options) => request('/predict/template-columns', options)

export const getSampleCsvUrl = () => `${API_BASE}/api/predict/sample-csv?rows=10`

export const batchPredict = (file, { signal } = {}) => {
  const form = new FormData()
  form.append('file', file, file.name)
  return request('/predict/batch', { method: 'POST', body: form, signal, timeout: 120000 })
}

/** Triggers a browser download of a finished batch job. */
export async function downloadBatch(jobId, filename = 'predictions.csv') {
  const response = await request(`/predict/batch/${jobId}/download`, { raw: true })
  const blob = await response.blob()
  saveBlob(blob, filename)
  return blob
}

// ---------------------------------------------------------------- dataset ---
export const getDatasetSummary = (options) => request('/dataset/summary', options)

export const getDatasetRows = (params, options) => request(`/dataset/sample${query(params)}`, options)

export const getCorrelation = (options) => request('/dataset/correlation', options)

export const getDatasetDownloadUrl = () => `${API_BASE}/api/dataset/download`

// --------------------------------------------------------------- analytics ---
export const getAnalytics = (params = {}, options) => request(`/analytics${query(params)}`, options)

// ------------------------------------------------------------------ model ---
export const getModelInfo = (options) => request('/model/info', options)

export const getModelFeatures = (options) => request('/model/features', options)

export const getModelMetrics = (options) => request('/model/metrics', options)

export const getModelWorkflow = (options) => request('/model/workflow', options)

// ---------------------------------------------------------------- history ---
export const getHistory = (params = {}, options) => request(`/history${query(params)}`, options)

export const deleteHistoryItem = (id, options) =>
  request(`/history/${id}`, { method: 'DELETE', ...options })

export const clearHistory = (options) => request('/history', { method: 'DELETE', ...options })

// ------------------------------------------------------------------ files ---
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text, filename, mimeType = 'text/csv;charset=utf-8') {
  // BOM keeps Excel happy with UTF-8 CSVs.
  saveBlob(new Blob([`\uFEFF${text}`], { type: mimeType }), filename)
}

/** Fetches an authenticated-by-URL endpoint and saves it as a file. */
export async function downloadFromUrl(url, filename) {
  const response = await fetch(url)
  if (!response.ok) throw await toError(response)
  saveBlob(await response.blob(), filename)
}
