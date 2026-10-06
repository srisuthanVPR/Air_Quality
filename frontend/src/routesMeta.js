/**
 * Route metadata shared between the layout (topbar title) and the pages
 * (document title, header copy). Keeping one table avoids the topbar saying
 * "Explore data" while the page itself is called "Dataset Explorer".
 */
import {
  BookOpen,
  Gauge,
  History,
  Layers,
  LineChart,
  Sparkles,
  Table2,
  Upload,
} from 'lucide-react'

export const ROUTES = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    description:
      'Model readiness, dataset scale and the state of your recent predictions in one view.',
    icon: Gauge,
  },
  {
    path: '/predict',
    title: 'Predict',
    description: 'Enter sensor readings and get an air quality class with confidence.',
    icon: Sparkles,
  },
  {
    path: '/batch',
    title: 'Batch CSV',
    description: 'Score an entire CSV of hourly readings and download the results.',
    icon: Upload,
  },
  {
    path: '/analytics',
    title: 'Analytics',
    description: 'Temporal, correlation and pollutant breakdowns across the dataset.',
    icon: LineChart,
  },
  {
    path: '/dataset',
    title: 'Dataset Explorer',
    description: 'Browse, filter and inspect every row of AirQualityUCI.',
    icon: Table2,
  },
  {
    path: '/model',
    title: 'Model Performance',
    description: 'Real evaluation metrics, per-class scores, baselines and importances.',
    icon: Layers,
  },
  {
    path: '/history',
    title: 'Prediction History',
    description: 'Every prediction made in this browser session, with search and export.',
    icon: History,
  },
  {
    path: '/about',
    title: 'About',
    description: 'What the model does, what the numbers mean and where the data came from.',
    icon: BookOpen,
  },
]

/** `{ '/predict': 'Predict', ... }` for the topbar heading. */
export const PAGE_TITLES = Object.fromEntries(ROUTES.map((route) => [route.path, route.title]))

/** Short labels for inline navigation (the 404 page, breadcrumbs). */
export const routesMeta = ROUTES.map((route) => ({
  path: route.path,
  label: route.title,
  icon: route.icon,
}))
