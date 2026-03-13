import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useStore } from './core/store.js'
import { useShallow } from 'zustand/react/shallow'
import { resolvePanel } from './core/roles.js'
import { initReactiveCore } from './core/reactive.js'
import { Sidebar } from './components/shared/Sidebar.jsx'
import { TopBar } from './components/shared/TopBar.jsx'
import { PreviewBanner } from './components/shared/PreviewBanner.jsx'
import { ReactiveToast } from './components/shared/ReactiveToast.jsx'
import { MobileBottomNav } from './components/shared/MobileBottomNav.jsx'
import { UniversalUpload } from './components/shared/UniversalUpload.jsx'
import { LoginScreen } from './roles/LoginScreen.jsx'
import { JoinScreen } from './roles/JoinScreen.jsx'
import { AppShell } from './AppShell.jsx'
import { CaptureButton } from './modules/capture/index.jsx'
import { SuperAdminPanel } from './panels/SuperAdminPanel.jsx'
import { BackgroundOrbs } from './components/shared/BackgroundOrbs.jsx'
import './index.css'

const DevSeed = lazy(() => import('./dev/DevSeed.jsx').then(m => ({ default: m.DevSeed })))

export default function App() {
  useEffect(() => { initReactiveCore() }, [])
  const {  auth, login, wallpaper, navigate  } = useStore(useShallow(s => ({ auth: s.auth, login: s.login, wallpaper: s.wallpaper, navigate: s.navigate })))
  const theme = auth.theme || 'dark'

  // ?seed → página de seed para desenvolvimento
  const isSeedMode = useMemo(() => new URLSearchParams(window.location.search).has('seed'), [])

  // ?module=X → deep link from PWA shortcuts
  const deepLinkModule = useMemo(() => new URLSearchParams(window.location.search).get('module'), [])

  // ?reset → limpa localStorage e recarrega
  // ?admin → auto-login como Super Admin
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('reset')) {
      localStorage.removeItem('frame-v1')
      window.location.href = window.location.pathname
      return
    }
    if (params.has('admin') && !auth.isAuthenticated) {
      login(
        { name: 'GPS', email: 'superadmin@flameboard.pt', photo: null, uid: null },
        'director_producao',
        null,
        true
      )
      window.history.replaceState({}, '', window.location.pathname)
    }
    // PWA shortcut deep link — navigate after auth
    if (deepLinkModule && auth.isAuthenticated) {
      navigate(deepLinkModule)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [auth.isAuthenticated])

  // Auto-seed removed — use "Carregar Dados Demo" in Settings to seed manually

  // Offline indicator
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Apply theme to <html> so CSS [data-theme="light"] works
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Wallpaper — set CSS custom properties on :root
  useEffect(() => {
    const root = document.documentElement
    const wp = wallpaper || {}
    root.style.setProperty('--glass-opacity', String(wp.opacity ?? 0.85))
    root.style.setProperty('--glass-blur', `${wp.blur ?? 20}px`)
  }, [wallpaper])

  // Detect invite token from URL (?join=TOKEN or #join=TOKEN)
  const joinToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('join')) return params.get('join')
    const hash = window.location.hash
    if (hash.startsWith('#join=')) return hash.slice(6)
    return null
  }, [])

  // Seed mode — bypass login
  if (isSeedMode) {
    return (
      <Suspense fallback={<div style={{ color: '#fff', padding: 40 }}>A carregar DevSeed…</div>}>
        <DevSeed />
      </Suspense>
    )
  }

  // Join flow takes priority over normal login
  if (joinToken && !auth.isAuthenticated) {
    return <JoinScreen token={joinToken} />
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen />
  }

  const panel = resolvePanel(auth)
  const hasPreview = auth.previewPanel || auth.previewRole
  const topOffset = hasPreview ? 32 : 0

  // Painel 1 — Super Admin
  if (panel === 'superadmin') {
    return <SuperAdminPanel />
  }

  const offlineBanner = offline ? (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#d97706', color: '#fff', textAlign: 'center',
      padding: '6px 12px', fontSize: 13, fontWeight: 600,
      letterSpacing: '0.02em',
    }}>
      Offline — as alterações ser\u00e3o sincronizadas quando a liga\u00e7\u00e3o voltar
    </div>
  ) : null

  const offlineHeight = offline ? 32 : 0

  // Painel 2 (management) e Painel 3 (roleview) partilham Sidebar + AppShell
  // A diferença está nos módulos visíveis (filtrados pelo canAccess) e no dashboard
  const wpActive = wallpaper?.type && wallpaper.type !== 'none'

  return (
    <>
      {offlineBanner}
      {hasPreview && <PreviewBanner />}
      {!wpActive && <BackgroundOrbs />}
      {wpActive && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0,
          backgroundImage: wallpaper.type === 'gradient' ? wallpaper.gradient
            : `url(${wallpaper.type === 'preset' ? `/wallpapers/${wallpaper.preset}.jpg` : wallpaper.customUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(0,0,0,${wallpaper.dim ?? 0.3})`,
          }} />
        </div>
      )}
      <UniversalUpload>
        <div className="app-layout" style={{
          display: 'flex',
          height: hasPreview ? `calc(100vh - ${32 + offlineHeight}px)` : `calc(100vh - ${offlineHeight}px)`,
          marginTop: topOffset + offlineHeight,
          width: '100vw',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}>
          <Sidebar panelMode={panel} />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <TopBar />
            <AppShell />
          </div>
          <CaptureButton />
          <ReactiveToast />
          <MobileBottomNav />
        </div>
      </UniversalUpload>
    </>
  )
}
