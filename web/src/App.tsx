import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { t, useLang } from '@/i18n'
import { ComingSoon } from '@/pages/ComingSoon'
import { DemoApp } from '@/pages/DemoApp'
import { ShowcasePage } from '@/pages/ShowcasePage'
import { BoardPage } from '@/pages/app/BoardPage'
import { DashboardPage } from '@/pages/app/DashboardPage'
import { JobsPage } from '@/pages/app/JobsPage'
import { PacksPage } from '@/pages/app/PacksPage'
import { ProfilePage } from '@/pages/app/ProfilePage'

// The public build (npm run build:public, for putting the showcase online) leaves /app out
// completely: VITE_PUBLIC is fixed when building, so the code that talks to serve.py is not even
// in the files. Only "/" (showcase) and "/demo" (sample data) are online.
const PUBLIC = import.meta.env.VITE_PUBLIC === '1'
const LiveApp = PUBLIC ? null : lazy(() => import('@/pages/app/LiveApp'))

/** The pages inside the app, the same for /app (your jobs) and /demo (sample data) */
function appPages(): ReactNode {
  return (
    <>
      <Route index element={<DashboardPage />} />
      <Route path="jobs" element={<JobsPage />} />
      <Route path="jobs/:n" element={<JobsPage />} />
      <Route path="board" element={<BoardPage />} />
      <Route path="packs" element={<PacksPage />} />
      <Route path="packs/:n" element={<PacksPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </>
  )
}

// The pages of the app. "/" and "/demo" are public (sample data); "/app" is private and local (your real jobs).
export default function App() {
  // a new language re-renders every page (key), so each t() call picks it up
  const lang = useLang()
  return (
    <BrowserRouter key={lang}>
      <Routes>
        <Route path="/" element={<ShowcasePage />} />
        <Route path="/demo" element={<DemoApp />}>{appPages()}</Route>
        {LiveApp && (
          <Route path="/app" element={<Suspense fallback={null}><LiveApp /></Suspense>}>{appPages()}</Route>
        )}
        <Route path="*" element={<ComingSoon name={t('This page')} />} />
      </Routes>
    </BrowserRouter>
  )
}
