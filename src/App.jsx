import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { FamilyDataProvider, useFamily } from './data/FamilyDataProvider'
import { Toaster, useThemeSync } from './components/ui'
import BottomNav from './components/shell/BottomNav'
import OfflineIndicator from './components/shell/OfflineIndicator'
import { AppError, AppLoading } from './components/shell/AppStatus'
import { LogSheetProvider, useLogSheet } from './features/log/LogSheetContext'
import LogSheet from './features/log/LogSheet'
import AchievementWatcher from './features/achievements/AchievementWatcher'
import WelcomeGate from './features/profile/WelcomeGate'
import LoginPage from './features/auth/LoginPage'
import TodayPage from './features/today/TodayPage'
import FeedPage from './features/feed/FeedPage'
import AchievementsPage from './features/achievements/AchievementsPage'
import ProfilePage from './features/profile/ProfilePage'
import ArchivePage from './features/profile/ArchivePage'
import WhatsNewPage from './features/profile/WhatsNewPage'
import MemberPage from './features/member/MemberPage'
import HabitsPage from './features/habits/HabitsPage'
import StatsPage from './features/stats/StatsPage'
import GoalsPage from './features/goals/GoalsPage'

const IS_DEMO = import.meta.env.MODE === 'demo' || Boolean(import.meta.env.VITE_DEMO)

function LegacyUserRedirect() {
  const { userId } = useParams()
  return <Navigate to={`/u/${userId}`} replace />
}

/** En desarrollo, #/dev/ui se monta fuera de la app (main.jsx): recarga para llegar. */
function DevGalleryReload() {
  useEffect(() => {
    window.location.reload()
  }, [])
  return null
}

/** Vuelve arriba al cambiar de pantalla (HashRouter no lo hace solo). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Shell() {
  const { currentUser } = useAuth()
  const { ready, error, actions } = useFamily()
  const { openLog } = useLogSheet()

  // Registro silencioso del token de notificaciones (nunca en modo demo).
  useEffect(() => {
    if (IS_DEMO || !currentUser || !ready) return
    const t = setTimeout(() => {
      Promise.resolve(actions?.registerPush?.()).catch(() => {})
    }, 3000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, ready])

  if (error) return <AppError error={error} />
  if (!ready) return <AppLoading />

  return (
    <>
      <ScrollToTop />
      <OfflineIndicator />
      <main className="mx-auto w-full max-w-md px-4 pt-safe pb-nav">
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/familia" element={<FeedPage />} />
          <Route path="/logros" element={<AchievementsPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/u/:userId" element={<MemberPage />} />
          <Route path="/habitos" element={<HabitsPage />} />
          <Route path="/metas" element={<GoalsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/archivo" element={<ArchivePage />} />
          <Route path="/novedades" element={<WhatsNewPage />} />
          <Route path="/feed" element={<Navigate to="/familia" replace />} />
          <Route path="/user/:userId" element={<LegacyUserRedirect />} />
          {import.meta.env.DEV && <Route path="/dev/ui" element={<DevGalleryReload />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav userId={currentUser?.id} onLog={() => openLog()} />
      <LogSheet />
      <AchievementWatcher />
      <WelcomeGate />
    </>
  )
}

function AuthGate() {
  const { isLoggedIn, loading } = useAuth()
  if (loading) return <AppLoading label="Abriendo FitFamily" />
  if (!isLoggedIn) return <LoginPage />
  return (
    <FamilyDataProvider>
      <LogSheetProvider>
        <Shell />
      </LogSheetProvider>
    </FamilyDataProvider>
  )
}

export default function App() {
  useThemeSync()
  return (
    <AuthProvider>
      <Toaster />
      <AuthGate />
    </AuthProvider>
  )
}
