// Sidebar vertical esquerda — colapsável, com groups expansíveis
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clapperboard, Film, Zap,
  MapPin, Users, Eye, DollarSign, Radio,
  ChevronRight, ChevronDown, Settings, PanelLeftClose, PanelLeftOpen,
  UserPlus, Lock, ListChecks,
  Palette, Scissors, BookOpen,
} from 'lucide-react'
import { useStore } from '../../core/store.js'
import { useShallow } from 'zustand/react/shallow'
import { useI18n } from '../../core/i18n/index.js'
import { canAccess } from '../../core/router.js'
import { isAdmin } from '../../core/roles.js'
import { FrameFlowLogo } from './FrameFlowLogo.jsx'
import { InviteManager } from './InviteManager.jsx'
import styles from './Sidebar.module.css'

// Nova estrutura de menus — groups com children (Figma FF_V04)
const MENU = [
  { id: 'dashboard', icon: Clapperboard, color: 'var(--accent)', label: 'Dashboard' },
  { id: 'pre-production', icon: ListChecks, color: 'var(--mod-preproduction, #2EA080)', label: 'Pré-Produção' },
  { id: '_produção', icon: Film, color: 'var(--mod-production)', label: 'Produção', group: true, children: [
    { id: 'production', label: 'Strip Board' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'callsheet', label: 'Folha Serviço' },
  ]},
  { id: 'post-production', icon: Scissors, color: '#9B59B6', label: 'Pós-Produção' },
  { id: '_filme', icon: BookOpen, color: 'var(--mod-universe, #7B4FBF)', label: 'O Filme', group: true, children: [
    { id: 'script', label: 'Guiões' },
    { id: 'continuity', label: 'Continuidade' },
    { id: 'universe', label: 'Universo' },
    { id: 'script-analysis', label: 'Episódios' },
    { id: 'bible', label: 'Bíblia' },
    { id: 'writers-room', label: 'Writers Room' },
    { id: 'files', label: 'Ficheiros' },
  ]},
  { id: 'locations', icon: MapPin, color: 'var(--mod-locations)', label: 'Locais' },
  { id: '_equipa', icon: Users, color: 'var(--mod-team)', label: 'Equipa', group: true, children: [
    { id: 'team', label: 'Crew' },
    { id: 'cast', label: 'Elenco' },
  ]},
  { id: '_departamentos', icon: Palette, color: 'var(--mod-departments, #A02E6F)', label: 'Departamentos', group: true, children: [
    { id: 'dept-arte', label: 'Arte' },
    { id: 'dept-guardaroupa', label: 'Guarda-Roupa' },
    { id: 'dept-makeup', label: 'Makeup & Hair' },
    { id: 'dept-camara', label: 'Câmara' },
    { id: 'dept-som', label: 'Som' },
    { id: 'dept-casting', label: 'Casting' },
    { id: 'dept-transporte', label: 'Transporte' },
    { id: 'dept-stunts', label: 'Stunts' },
  ]},
  { id: '_optimização', icon: Zap, color: 'var(--mod-optimization, #F5A623)', label: 'Optimização', group: true, children: [
    { id: 'optimization', label: 'Riscos' },
    { id: 'canon', label: 'Canon' },
    { id: 'meals', label: 'Meals' },
    { id: 'health-safety', label: 'Saúde & Segurança' },
  ]},
  { id: 'mirror', icon: Eye, color: 'var(--mod-mirror, #5B8DEF)', label: 'Espelho' },
  { id: '_financas', icon: DollarSign, color: 'var(--mod-budget)', label: 'Finanças', badge: 'lock', group: true, children: [
    { id: 'budget', label: 'Orçamento' },
    { id: 'finance', label: 'Despesas' },
    { id: 'progress', label: 'Relatórios' },
  ]},
  { id: 'live-board', icon: Radio, color: '#EF4444', label: 'Live Board', badge: 'live' },
]

export function Sidebar({ panelMode = 'management' }) {
  const { ui, auth, navigate, toggleSidebar, closeMobileSidebar, projectName, setProjectName, wallpaper } = useStore(useShallow(s => ({ ui: s.ui, auth: s.auth, navigate: s.navigate, toggleSidebar: s.toggleSidebar, closeMobileSidebar: s.closeMobileSidebar, projectName: s.projectName, setProjectName: s.setProjectName, wallpaper: s.wallpaper })))
  const { t } = useI18n()
  const { sidebarOpen, activeModule, mobileSidebarOpen } = ui
  const { role } = auth
  const [showInvites, setShowInvites] = useState(false)
  const isRoleView = panelMode === 'roleview'
  const showInviteBtn = isAdmin(role)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState(projectName)
  const nameRef = useRef(null)

  const commitName = () => {
    const v = nameInput.trim()
    if (v) setProjectName(v)
    setEditingName(false)
  }

  // Expanded groups state — start all collapsed
  const [expanded, setExpanded] = useState({})
  const toggleGroup = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  // Filter menu: for groups, filter children by canAccess; for singles, check directly
  const visibleMenu = MENU.map(item => {
    if (item.group) {
      const kids = item.children.filter(c => canAccess(role, c.id))
      return kids.length > 0 ? { ...item, children: kids } : null
    }
    return canAccess(role, item.id) ? item : null
  }).filter(Boolean)

  const wpActive = wallpaper?.type && wallpaper.type !== 'none'

  // Close mobile sidebar when navigating
  const handleNavigate = (id) => {
    navigate(id)
    closeMobileSidebar()
  }

  return (
    <>
    {/* Mobile backdrop */}
    <AnimatePresence>
      {mobileSidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeMobileSidebar}
          style={{
            display: 'none',
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          className={styles.mobileBackdrop}
        />
      )}
    </AnimatePresence>
    <motion.aside
      className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarMobileOpen : ''}`}
      data-glass
      animate={{ width: sidebarOpen ? 'var(--sidebar-width-open)' : 'var(--sidebar-width)' }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={wpActive ? {
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRight: '1px solid var(--glass-border)',
      } : undefined}
    >
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <FrameFlowLogo size={32} />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                style={{ flex: 1, minWidth: 0 }}
              >
                <span className={styles.logoText}>FrameFlow</span>
                {!isRoleView && editingName ? (
                  <input
                    ref={nameRef}
                    className={styles.projectNameInput}
                    value={nameInput}
                    autoFocus
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
                  />
                ) : (
                  <button
                    className={styles.projectNameBtn}
                    onClick={isRoleView ? undefined : () => { setNameInput(projectName); setEditingName(true) }}
                    title={isRoleView ? projectName : undefined}
                    style={isRoleView ? { cursor: 'default' } : undefined}
                  >
                    {projectName}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            className={styles.collapseBtn}
            onClick={toggleSidebar}
            title={sidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>
      </div>

      {/* Navegação */}
      <nav className={styles.nav}>
        {visibleMenu.map(item => {
          if (item.group) {
            const childActive = item.children.some(c => activeModule === c.id)
            const isExpanded = expanded[item.id] ?? childActive
            return (
              <div key={item.id} className={styles.menuGroup}>
                <motion.button
                  className={`${styles.groupHeader} ${childActive ? styles.groupActive : ''}`}
                  style={{ '--item-color': item.color }}
                  onClick={() => sidebarOpen ? toggleGroup(item.id) : handleNavigate(item.children[0].id)}
                  title={!sidebarOpen ? item.label : undefined}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className={styles.itemIcon}><item.icon size={18} /></span>
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        className={styles.itemLabel}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.13 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {sidebarOpen && item.badge === 'live' && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 6px #EF4444', flexShrink: 0 }} />
                  )}
                  {sidebarOpen && item.badge === 'lock' && (
                    <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.6 }} />
                  )}
                  {sidebarOpen && (
                    <motion.span
                      className={styles.groupChevron}
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown size={13} />
                    </motion.span>
                  )}
                  {childActive && <span className={styles.activeBar} />}
                </motion.button>
                <AnimatePresence>
                  {isExpanded && sidebarOpen && (
                    <motion.div
                      className={styles.groupChildren}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {item.children.map(child => (
                        <motion.button
                          key={child.id}
                          className={`${styles.childItem} ${activeModule === child.id ? styles.childActive : ''}`}
                          style={{ '--item-color': item.color }}
                          onClick={() => handleNavigate(child.id)}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <span className={styles.childDot} />
                          <span>{child.label}</span>
                          {child.badge === 'live' && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 5px #EF4444', marginLeft: 'auto', flexShrink: 0 }} />
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          }
          // Single item (no group)
          return (
            <SidebarItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={<item.icon size={18} />}
              color={item.color}
              active={activeModule === item.id}
              open={sidebarOpen}
              onClick={() => handleNavigate(item.id)}
              badge={item.badge}
            />
          )
        })}
      </nav>

      {/* Rodapé */}
      <div className={styles.footer}>
        <SidebarItem
          id="settings"
          label={t('sidebar.settings')}
          icon={<Settings size={16} />}
          color="var(--text-muted)"
          active={activeModule === 'settings'}
          open={sidebarOpen}
          onClick={() => handleNavigate('settings')}
          small
        />
        {/* Invite manager — admins podem criar convites */}
        {showInviteBtn && (
          <SidebarItem
            id="invites"
            label={t('sidebar.invites')}
            icon={<UserPlus size={16} />}
            color="var(--accent)"
            active={showInvites}
            open={sidebarOpen}
            onClick={() => setShowInvites(true)}
            small
          />
        )}
      </div>

      {/* Invite drawer */}
      <InviteManager open={showInvites} onClose={() => setShowInvites(false)} />
    </motion.aside>
    </>
  )
}

// ── Item individual ─────────────────────────────────────────────────
function SidebarItem({ label, icon, color, active, open, onClick, small, badge }) {
  return (
    <motion.button
      className={`${styles.item} ${active ? styles.itemActive : ''} ${small ? styles.itemSmall : ''}`}
      style={{ '--item-color': color }}
      onClick={onClick}
      title={!open ? label : undefined}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <AnimatePresence>
        {open && (
          <motion.span
            className={styles.itemLabel}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.13 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {open && badge === 'live' && (
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 6px #EF4444', flexShrink: 0, marginLeft: 'auto' }} />
      )}
      {active && open && !badge && (
        <motion.span className={styles.itemChevron} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ChevronRight size={13} />
        </motion.span>
      )}
      {active && <span className={styles.activeBar} />}
    </motion.button>
  )
}
