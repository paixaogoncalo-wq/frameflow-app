import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ChevronDown, ChevronRight, Shield, Terminal, CheckCircle } from 'lucide-react'
import { useStore } from '../core/store.js'
import { useShallow } from 'zustand/react/shallow'
import { useI18n } from '../core/i18n/index.js'
import { getRolesByDepartment, ROLES } from '../core/roles.js'
import { FrameFlowLogo } from '../components/shared/FrameFlowLogo.jsx'
import styles from './LoginScreen.module.css'

// Logins rápidos para desenvolvimento
const DEV_USERS = [
  { email: 'superadmin@flameboard.pt', role: 'director_producao',  name: 'GPS',             isSuperAdmin: true },
  { email: 'produtor@flameboard.pt',   role: 'director_producao',  name: 'Ana Rodrigues' },
  { email: 'realizador@flameboard.pt', role: 'realizador',         name: 'João Silva' },
  { email: 'dop@flameboard.pt',        role: 'dir_fotografia',     name: 'Pedro Costa' },
  { email: 'actor@flameboard.pt',      role: 'elenco_principal',   name: 'Rui Faria' },
  { email: 'ap@flameboard.pt',         role: 'assistente_producao', name: 'Catarina Lima' },
  { email: '1ad@flameboard.pt',        role: 'primeiro_ad',        name: 'Miguel Santos' },
  { email: 'anotadora@flameboard.pt',  role: 'anotadora',          name: 'Sofia Mendes' },
]

export function LoginScreen() {
  const { t } = useI18n()
  const { login, projectName } = useStore(useShallow(s => ({ login: s.login, projectName: s.projectName })))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleUser, setGoogleUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showDevMenu, setShowDevMenu] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  // Toggle login ↔ signup
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  // Signup fields
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPw, setSignupPw] = useState('')
  const [signupPw2, setSignupPw2] = useState('')
  const [showPw1, setShowPw1] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      const { signInWithGoogle } = await import('../core/firebase.js')
      const user = await signInWithGoogle()
      setGoogleUser(user)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError(t('auth.googleError'))
      }
    }
    setLoading(false)
  }

  const handleRoleSelect = (roleId) => {
    const role = ROLES[roleId]
    login(googleUser, roleId, role?.dept || null)
    const projectId = useStore.getState().currentProjectId
    if (projectId) {
      import('../core/firebase.js').then(({ ensureUserDoc }) => {
        ensureUserDoc(projectId, googleUser, roleId, role?.dept || null)
      })
    }
  }

  const quickLogin = (u) => {
    const role = ROLES[u.role]
    login({ name: u.name, email: u.email, photo: null, uid: null }, u.role, role?.dept || null, !!u.isSuperAdmin)
  }

  const handleSuperAdmin = () => {
    quickLogin(DEV_USERS[0])
  }

  const handleSignup = () => {
    // For now, signup goes through Google auth
    handleGoogle()
  }

  const switchTo = (newMode) => {
    setMode(newMode)
    setError('')
    setGoogleUser(null)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.bg} />

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className={styles.content}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >

          {/* ══════════════════════════════════════════════
              LOGIN MODE
              ══════════════════════════════════════════════ */}
          {mode === 'login' && (
            <>
              {/* Logo */}
              <div className={styles.logoArea}>
                <FrameFlowLogo size={48} />
                <h1 className={styles.logoName}>FrameFlow</h1>
                <span className={styles.logoSub}>Produção cinematográfica profissional</span>
              </div>

              {/* Glass card */}
              <div className={styles.glassCard} data-glass>
                {!googleUser ? (
                  <>
                    <div className={styles.fieldGroup}>
                      <div className={styles.field}>
                        <label className={styles.label}>EMAIL</label>
                        <div className={styles.inputWrap}>
                          <input
                            className={styles.input}
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>PASSWORD</label>
                        <div className={styles.inputWrap}>
                          <input
                            className={styles.input}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                          />
                          <button className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} type="button">
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.optionsRow}>
                      <label className={styles.checkboxWrap}>
                        <input type="checkbox" className={styles.checkbox} checked={remember} onChange={e => setRemember(e.target.checked)} />
                        <span className={styles.checkLabel}>Lembrar-me</span>
                      </label>
                      <button className={styles.forgotLink} type="button">Esqueceu password?</button>
                    </div>

                    <button className={styles.primaryBtn} disabled={loading} onClick={handleGoogle}>
                      Entrar
                    </button>

                    <div className={styles.divider}>
                      <div className={styles.dividerLine} />
                      <span className={styles.dividerText}>OU</span>
                      <div className={styles.dividerLine} />
                    </div>

                    <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
                      {loading ? <span className={styles.googleSpinner} /> : <GoogleIcon />}
                      {loading ? 'A autenticar...' : 'Entrar com Google'}
                    </button>

                    <button className={styles.outlineBtn} onClick={handleSuperAdmin}>
                      <Shield size={14} />
                      ENTRAR COMO SUPER ADMIN
                    </button>

                    <button className={styles.outlineBtn} onClick={() => setShowDevMenu(true)}>
                      <Terminal size={14} />
                      ABRIR MENU DEV
                    </button>

                    {error && <p className={styles.error}>{error}</p>}
                  </>
                ) : (
                  <motion.div className={styles.roleSelect} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <div className={styles.googleUserInfo}>
                      {googleUser.photo && <img src={googleUser.photo} alt="" className={styles.googleAvatar} referrerPolicy="no-referrer" />}
                      <div>
                        <p className={styles.googleUserName}>{googleUser.name}</p>
                        <p className={styles.googleUserEmail}>{googleUser.email}</p>
                      </div>
                    </div>
                    <p className={styles.roleLabel}>{t('auth.selectRole', { project: projectName })}</p>
                    <DepartmentRolePicker onSelect={handleRoleSelect} />
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className={styles.footer}>
                <p className={styles.footerLink}>
                  Não tem conta? <button type="button" onClick={() => switchTo('signup')}>Criar conta</button>
                </p>
                <p className={styles.copyright}>© 2026 FrameFlow. Produção cinematográfica de excelência.</p>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════
              SIGNUP MODE (Criar conta)
              ══════════════════════════════════════════════ */}
          {mode === 'signup' && (
            <>
              {/* Logo — lens icon */}
              <div className={styles.logoArea}>
                <div className={styles.lensIcon}>
                  <div className={styles.lensInner} />
                </div>
                <h1 className={styles.logoName}>Bem-vindo</h1>
                <span className={styles.logoSub}>Complete o seu registo para aceder ao projeto</span>
              </div>

              {/* Invite badge */}
              <div className={styles.inviteBadge}>
                <div className={styles.inviteBadgeLabel}>FOI CONVIDADO PARA</div>
                <div className={styles.inviteBadgeRow}>
                  <CheckCircle size={20} className={styles.inviteBadgeIcon} />
                  <div>
                    <div className={styles.inviteProject}>{projectName || 'FrameFlow'}</div>
                    <div className={styles.inviteEmail}>maria.silva@frameflow.pt</div>
                  </div>
                </div>
              </div>

              {/* Glass form card */}
              <div className={styles.glassCard} data-glass>
                <div className={styles.fieldGroup}>
                  <div className={styles.field}>
                    <label className={styles.label}>NOME COMPLETO</label>
                    <div className={styles.inputWrap}>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Maria Silva"
                        value={signupName}
                        onChange={e => setSignupName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>PASSWORD</label>
                    <div className={styles.inputWrap}>
                      <input
                        className={styles.input}
                        type={showPw1 ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={signupPw}
                        onChange={e => setSignupPw(e.target.value)}
                      />
                      <button className={styles.eyeBtn} onClick={() => setShowPw1(!showPw1)} type="button">
                        {showPw1 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>CONFIRMAR PASSWORD</label>
                    <div className={styles.inputWrap}>
                      <input
                        className={styles.input}
                        type={showPw2 ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={signupPw2}
                        onChange={e => setSignupPw2(e.target.value)}
                      />
                      <button className={styles.eyeBtn} onClick={() => setShowPw2(!showPw2)} type="button">
                        {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button className={styles.primaryBtn} disabled={loading} onClick={handleSignup}>
                  {loading ? 'A registar...' : 'Completar Registo'}
                </button>

                <div className={styles.divider}>
                  <div className={styles.dividerLine} />
                  <span className={styles.dividerText}>OU</span>
                  <div className={styles.dividerLine} />
                </div>

                <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
                  {loading ? <span className={styles.googleSpinner} /> : <GoogleIcon />}
                  {loading ? 'A autenticar...' : 'Continuar com Google'}
                </button>

                <p className={styles.terms}>
                  Ao completar o registo, concorda com os{' '}
                  <button type="button">Termos de Serviço</button> e{' '}
                  <button type="button">Política de Privacidade</button>
                </p>

                {error && <p className={styles.error}>{error}</p>}
              </div>

              {/* Footer */}
              <div className={styles.footer}>
                <p className={styles.footerLink}>
                  Já tem conta? <button type="button" onClick={() => switchTo('login')}>Entrar</button>
                </p>
              </div>
            </>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── Dev Menu overlay ── */}
      <AnimatePresence>
        {showDevMenu && (
          <motion.div
            className={styles.devOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowDevMenu(false) }}
          >
            <motion.div
              className={styles.devPanel}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className={styles.devTitle}>Menu Dev</h2>
              <p className={styles.devSubtitle}>Logins rápidos para desenvolvimento</p>
              <div className={styles.devGrid}>
                {DEV_USERS.map(u => (
                  <button
                    key={u.email}
                    className={styles.devBtn}
                    onClick={() => { setShowDevMenu(false); quickLogin(u) }}
                    style={u.isSuperAdmin ? { borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.06)' } : undefined}
                  >
                    <span className={styles.devRole}>{u.isSuperAdmin ? 'Super Admin' : ROLES[u.role]?.label || u.role}</span>
                    <span className={styles.devName}>{u.name}</span>
                  </button>
                ))}
              </div>
              <button className={styles.devClose} onClick={() => setShowDevMenu(false)}>
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Picker de roles por departamento (colapsável) ──────────────────
function DepartmentRolePicker({ onSelect }) {
  const departments = getRolesByDepartment()
  const [expanded, setExpanded] = useState(null)

  return (
    <div className={styles.deptList}>
      {departments.map(dept => (
        <div key={dept.id} className={styles.deptGroup}>
          <button
            className={styles.deptHeader}
            onClick={() => setExpanded(expanded === dept.id ? null : dept.id)}
          >
            <span className={styles.deptDot} style={{ background: dept.color }} />
            <span className={styles.deptName}>{dept.label}</span>
            <span className={styles.deptCount}>{dept.roles.length}</span>
            {expanded === dept.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <AnimatePresence>
            {expanded === dept.id && (
              <motion.div
                className={styles.deptRoles}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {dept.roles.map(role => (
                  <button
                    key={role.id}
                    className={styles.roleBtn}
                    onClick={() => onSelect(role.id)}
                  >
                    <span>{role.label}</span>
                    {role.isHOD && <span className={styles.hodBadge}>HOD</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
