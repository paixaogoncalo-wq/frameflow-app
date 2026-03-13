// JoinScreen.jsx — Página de onboarding por convite
// Liquid Glass design matching Figma FF04

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useStore } from '../core/store.js'
import { useShallow } from 'zustand/react/shallow'
import { useI18n } from '../core/i18n/index.js'
import { ROLES } from '../core/roles.js'
import styles from './LoginScreen.module.css'
import joinStyles from './JoinScreen.module.css'

export function JoinScreen({ token }) {
  const { t } = useI18n()
  const { invites, useInvite, login, projectName } = useStore(useShallow(s => ({
    invites: s.invites, useInvite: s.useInvite, login: s.login, projectName: s.projectName,
  })))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')

  // Validate invite
  const invite = invites.find(i => i.token === token)
  const isValid = invite
    && invite.uses < invite.maxUses
    && new Date(invite.expiresAt) > new Date()

  const roleInfo = invite ? ROLES[invite.role] : null

  const handleJoin = async () => {
    setError('')
    setLoading(true)
    try {
      const { signInWithGoogle } = await import('../core/firebase.js')
      const user = await signInWithGoogle()
      const result = useInvite(token, user)
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      login(user, result.role, result.department)
      const url = new URL(window.location)
      url.searchParams.delete('join')
      url.hash = ''
      window.history.replaceState({}, '', url.pathname)
      setDone(true)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError(t('auth.googleError'))
      }
    }
    setLoading(false)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.bg} />

      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* ── Logo area ── */}
        <div className={styles.logoArea}>
          <div className={joinStyles.lensIcon}>
            <div className={joinStyles.lensInner} />
          </div>
          <h1 className={styles.logoName}>Bem-vindo</h1>
          <span className={styles.logoSub}>Complete o seu registo para aceder ao projeto</span>
        </div>

        {done ? (
          /* ── Success ── */
          <div className={styles.glassCard}>
            <div className={joinStyles.successState}>
              <Check size={32} className={joinStyles.successIcon} />
              <h2 className={joinStyles.successTitle}>{t('auth.welcome')}</h2>
              <p className={joinStyles.successSub}>
                {t('auth.welcomeProject', { project: projectName, role: roleInfo?.label || invite?.role })}
              </p>
            </div>
          </div>
        ) : !isValid ? (
          /* ── Invalid / expired ── */
          <div className={styles.glassCard}>
            <div className={joinStyles.errorState}>
              <AlertTriangle size={32} className={joinStyles.errorIcon} />
              <h2 className={joinStyles.errorTitle}>
                {!invite ? t('auth.inviteNotFound') : invite.uses >= invite.maxUses ? t('auth.inviteUsed') : t('auth.inviteExpired')}
              </h2>
              <p className={joinStyles.errorSub}>
                {!invite ? t('auth.inviteInvalidLink') : t('auth.inviteExpiredLink')}
              </p>
              <button className={joinStyles.backBtn} onClick={() => {
                const url = new URL(window.location)
                url.searchParams.delete('join')
                url.hash = ''
                window.history.replaceState({}, '', url.pathname)
                window.location.reload()
              }}>
                {t('auth.backToLogin')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Invite badge ── */}
            <div className={joinStyles.inviteBadge}>
              <div className={joinStyles.inviteBadgeLabel}>FOI CONVIDADO PARA</div>
              <div className={joinStyles.inviteBadgeRow}>
                <CheckCircle size={20} className={joinStyles.inviteBadgeIcon} />
                <div>
                  <div className={joinStyles.inviteProject}>{projectName || 'FrameFlow'}</div>
                  <div className={joinStyles.inviteEmail}>{invite.label || invite.createdBy || 'convite@frameflow.pt'}</div>
                </div>
              </div>
            </div>

            {/* ── Glass form card ── */}
            <div className={styles.glassCard}>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label className={styles.label}>NOME COMPLETO</label>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Maria Silva"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>PASSWORD</label>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.input}
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={pw}
                      onChange={e => setPw(e.target.value)}
                    />
                    <button className={styles.eyeBtn} onClick={() => setShowPw(!showPw)} type="button">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
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
                      value={pw2}
                      onChange={e => setPw2(e.target.value)}
                    />
                    <button className={styles.eyeBtn} onClick={() => setShowPw2(!showPw2)} type="button">
                      {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button className={styles.primaryBtn} onClick={handleJoin} disabled={loading}>
                {loading ? 'A entrar...' : 'Completar Registo'}
              </button>

              {/* Divider */}
              <div className={styles.divider}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerText}>OU</span>
                <div className={styles.dividerLine} />
              </div>

              {/* Google */}
              <button className={styles.googleBtn} onClick={handleJoin} disabled={loading}>
                {loading ? <span className={styles.googleSpinner} /> : <GoogleIcon />}
                {loading ? 'A autenticar...' : 'Continuar com Google'}
              </button>

              {/* Terms */}
              <p className={joinStyles.terms}>
                Ao completar o registo, concorda com os{' '}
                <button type="button">Termos de Serviço</button> e{' '}
                <button type="button">Política de Privacidade</button>
              </p>

              {error && <p className={styles.error}>{error}</p>}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <p className={styles.footerLink}>
                Já tem conta? <button type="button" onClick={() => {
                  const url = new URL(window.location)
                  url.searchParams.delete('join')
                  url.hash = ''
                  window.history.replaceState({}, '', url.pathname)
                  window.location.reload()
                }}>Entrar</button>
              </p>
            </div>
          </>
        )}
      </motion.div>
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
