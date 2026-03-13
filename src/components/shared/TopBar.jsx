// TopBar — barra superior persistente (Figma design)
// Projecto · Saúde · Alertas · Pesquisa ⌘K · Notificações · User

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, AlertTriangle, AlertCircle, Command, Menu } from 'lucide-react'
import { useStore } from '../../core/store.js'
import { useShallow } from 'zustand/react/shallow'
import { ROLES } from '../../core/roles.js'
import { CommandPalette } from './CommandPalette.jsx'
import { NotificationCenter } from './NotificationCenter.jsx'
import styles from './TopBar.module.css'

function getHealthStatus(shootingDays, team, locations, suggestions) {
  let score = 100
  const issues = { critical: 0, warnings: 0 }

  // Penalize for missing data
  if (!team?.length) { score -= 20; issues.warnings++ }
  if (!locations?.length) { score -= 15; issues.warnings++ }
  if (!shootingDays?.length) { score -= 20; issues.warnings++ }

  // Penalize for pending suggestions
  const pending = (suggestions || []).filter(s => s.status === 'pending')
  if (pending.length > 3) { score -= 10; issues.warnings += pending.length }
  if (pending.length > 6) { issues.critical++ }

  // Penalize for locations without confirmation
  const unconfirmed = (locations || []).filter(l => l.status !== 'confirmado')
  if (unconfirmed.length > 0) { score -= unconfirmed.length * 3; issues.warnings += unconfirmed.length }

  // Penalize for days without scenes
  const emptyDays = (shootingDays || []).filter(d => {
    // Simple check — will be enhanced later
    return !d.scenes?.length
  })
  if (emptyDays.length > 0) { score -= emptyDays.length * 5 }

  score = Math.max(0, Math.min(100, score))

  const color = score >= 70 ? 'var(--health-green)' : score >= 40 ? 'var(--health-yellow)' : 'var(--health-red)'
  return { score, color, critical: issues.critical, warnings: issues.warnings }
}

export function TopBar() {
  const {
    projectName, auth, team, locations, shootingDays, suggestions, navigate, ui,
    toggleMobileSidebar,
  } = useStore(useShallow(s => ({
    projectName: s.projectName,
    auth: s.auth,
    team: s.team,
    locations: s.locations,
    shootingDays: s.shootingDays,
    suggestions: s.suggestions,
    navigate: s.navigate,
    ui: s.ui,
    toggleMobileSidebar: s.toggleMobileSidebar,
  })))

  const [cmdOpen, setCmdOpen] = useState(false)

  const health = getHealthStatus(shootingDays, team, locations, suggestions)

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const roleDef = ROLES[auth.role]
  const roleLabel = roleDef?.label || auth.role || 'Utilizador'
  const userName = auth.user?.name || 'GPS'
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className={styles.topbar}>
      {/* Hamburger — mobile only */}
      <button
        className={styles.hamburger}
        onClick={toggleMobileSidebar}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Left: Project name + subtitle */}
      <div className={styles.left}>
        <div className={styles.projectBlock}>
          <span className={styles.projectName}>{projectName || 'FrameFlow'}</span>
          <span className={styles.projectSub}>PRODUCTION DASHBOARD</span>
        </div>
      </div>

      {/* Right: Search + Notifications + User */}
      <div className={styles.right}>
        {/* Search */}
        <button
          className={styles.searchTrigger}
          onClick={() => setCmdOpen(true)}
        >
          <Search size={14} />
          <span>Pesquisar cenas, personagens, locais...</span>
          <kbd className={styles.kbd}>
            <Command size={10} />K
          </kbd>
        </button>

        {/* Notifications */}
        <NotificationCenter />

        {/* User avatar */}
        <div className={styles.avatar}>
          {auth.user?.photo
            ? <img src={auth.user.photo} alt="" className={styles.avatarImg} />
            : <span>{userInitials}</span>
          }
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </header>
  )
}
