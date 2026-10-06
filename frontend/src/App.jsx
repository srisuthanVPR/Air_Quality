/**
 * Route table.
 *
 * `/` is the public landing page; everything else renders inside `AppLayout`.
 * Pages are imported lazily so the landing page — the first thing a visitor
 * sees — does not have to download the dataset explorer and chart bundle.
 */
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './layouts/AppLayout.jsx'
import { PublicLayout } from './layouts/PublicLayout.jsx'
import LoadingState from './components/RouteFallback.jsx'
import { ThemeProvider } from './hooks/useTheme.jsx'

const Landing = lazy(() => import('./pages/Landing.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Prediction = lazy(() => import('./pages/Prediction.jsx'))
const BatchPrediction = lazy(() => import('./pages/BatchPrediction.jsx'))
const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const DatasetExplorer = lazy(() => import('./pages/DatasetExplorer.jsx'))
const ModelPerformance = lazy(() => import('./pages/ModelPerformance.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const About = lazy(() => import('./pages/About.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingState fullScreen label="Loading Air Quality Intelligence" />}>
          <Routes>
            {/* Public */}
            <Route
              path="/"
              element={
                <PublicLayout>
                  <Landing />
                </PublicLayout>
              }
            />

            {/* Application */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/predict" element={<Prediction />} />
              <Route path="/batch" element={<BatchPrediction />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/dataset" element={<DatasetExplorer />} />
              <Route path="/model" element={<ModelPerformance />} />
              <Route path="/history" element={<History />} />
              <Route path="/about" element={<About />} />
            </Route>

            {/* `/index` was the old default route; keep old bookmarks working. */}
            <Route path="/index" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  )
}
