'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as allauth from '@/lib/allauth'

// ── Shared styles ──────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.55)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255, 255, 255, 0.75)',
  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)',
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400'
const BTN_PRIMARY = 'bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors'
const BTN_DANGER = 'text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-40'

// ── Google logo ────────────────────────────────────────────────────────────────

function GoogleLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ── Provider icon ──────────────────────────────────────────────────────────────

function ProviderIcon({ providerId }: { providerId: string }) {
  if (providerId === 'google') return <GoogleLogo className="w-4 h-4 shrink-0" />
  // Generic social icon for unknown providers
  return (
    <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}

// ── Section card wrapper ───────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={CARD}>
      <div className="px-5 py-4 sm:px-6 border-b border-black/5">
        <h2 className="text-xs font-bold tracking-widest uppercase text-gray-500">{title}</h2>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {children}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<allauth.AllauthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Email management
  const [emails, setEmails] = useState<allauth.EmailAddress[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // Password change
  const [currentPw, setCurrentPw] = useState('')
  const [newPw1, setNewPw1] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwErrors, setPwErrors] = useState<allauth.AllauthError[]>([])
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  // Social accounts
  const [providers, setProviders] = useState<allauth.ProviderAccount[]>([])

  useEffect(() => {
    allauth.getSession().then(res => {
      setLoading(false)
      if (!allauth.isAuthenticated(res)) {
        router.push('/auth/login?next=/account')
        return
      }
      setUser(res.data?.user ?? null)
    })
    allauth.getEmailAddresses().then(res => {
      if (res.status === 200) setEmails(res.data as unknown as allauth.EmailAddress[])
    })
    allauth.getProviderAccounts().then(res => {
      if (res.status === 200) setProviders(res.data as unknown as allauth.ProviderAccount[])
    })
  }, [router])

  // ── Email actions ────────────────────────────────────────────────────────────

  async function handleAddEmail(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setEmailLoading(true)
    setEmailMsg(null)
    const res = await allauth.addEmail(newEmail)
    setEmailLoading(false)
    if (res.status === 200) {
      setEmails(res.data as unknown as allauth.EmailAddress[])
      setNewEmail('')
      setEmailMsg({ type: 'ok', text: 'Verification email sent.' })
    } else {
      setEmailMsg({ type: 'err', text: res.errors?.[0]?.message ?? 'Failed to add email.' })
    }
  }

  async function handleDeleteEmail(email: string) {
    const res = await allauth.deleteEmail(email)
    if (res.status === 200) setEmails(res.data as unknown as allauth.EmailAddress[])
  }

  async function handleMakePrimary(email: string) {
    const res = await allauth.markEmailAsPrimary(email)
    if (res.status === 200) setEmails(res.data as unknown as allauth.EmailAddress[])
  }

  async function handleResendVerification(email: string) {
    await allauth.requestEmailVerification(email)
    setEmailMsg({ type: 'ok', text: `Verification email resent to ${email}.` })
  }

  // ── Password change ──────────────────────────────────────────────────────────

  async function handlePasswordChange(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (newPw1 !== newPw2) {
      setPwErrors([{ param: 'new_password2', message: 'Passwords do not match.' }])
      return
    }
    setPwLoading(true)
    setPwErrors([])
    setPwSuccess(false)
    const res = await allauth.changePassword(currentPw, newPw1)
    setPwLoading(false)
    if (res.status === 200) {
      setPwSuccess(true)
      setCurrentPw('')
      setNewPw1('')
      setNewPw2('')
    } else {
      setPwErrors(res.errors ?? [{ message: 'Failed to change password.' }])
    }
  }

  // ── Social accounts ──────────────────────────────────────────────────────────

  async function handleDisconnect(provider: allauth.ProviderAccount) {
    const res = await allauth.disconnectProviderAccount(provider.provider.id, provider.uid)
    if (res.status === 200) setProviders(res.data as unknown as allauth.ProviderAccount[])
  }

  function handleConnectGoogle() {
    allauth.connectToGoogle(`${window.location.origin}/auth/callback`)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const pwFieldErr = (param: string) => pwErrors.find(e => e.param === param)?.message
  const hasGoogle = providers.some(p => p.provider.id === 'google')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Profile card — back button lives inside the card so it has a background */}
        <div className="rounded-2xl px-5 py-5 sm:px-6" style={CARD}>
          <button
            onClick={() => router.push('/hives')}
            className="text-amber-900/60 text-sm tracking-widest uppercase hover:text-amber-900 transition-colors font-medium mb-4 flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-black tracking-widest uppercase text-gray-900">Account</h1>
            <div className="text-right min-w-0">
              <p className="text-xs tracking-widest uppercase text-gray-400 mb-0.5">Signed in as</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Email addresses */}
        <Card title="Email Addresses">
          {emailMsg && (
            <div className={`mb-4 text-sm rounded-lg px-3 py-2.5 ${emailMsg.type === 'ok' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>
              {emailMsg.text}
            </div>
          )}

          <ul className="space-y-3 mb-4">
            {emails.map(addr => (
              <li key={addr.email} className="rounded-xl bg-white/60 border border-white/80 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <span className="text-sm text-gray-900 truncate font-medium min-w-0 flex-1">{addr.email}</span>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${addr.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {addr.verified ? 'verified' : 'unverified'}
                    </span>
                    {addr.primary && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">primary</span>
                    )}
                  </div>
                </div>
                {/* Actions row */}
                {(!addr.primary || !addr.verified) && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-black/5 flex-wrap">
                    {!addr.primary && addr.verified && (
                      <button onClick={() => handleMakePrimary(addr.email)} className="text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors">
                        Make primary
                      </button>
                    )}
                    {!addr.verified && (
                      <button onClick={() => handleResendVerification(addr.email)} className="text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors">
                        Resend verification
                      </button>
                    )}
                    {!addr.primary && (
                      <button onClick={() => handleDeleteEmail(addr.email)} className={BTN_DANGER}>
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddEmail} className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Add email address"
              required
              className={INPUT + ' flex-1'}
            />
            <button type="submit" disabled={emailLoading} className={BTN_PRIMARY + ' shrink-0'}>
              {emailLoading ? '…' : 'Add'}
            </button>
          </form>
        </Card>

        {/* Connected accounts */}
        <Card title="Connected Accounts">
          {providers.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">No connected accounts.</p>
          )}

          {providers.length > 0 && (
            <ul className="space-y-2 mb-4">
              {providers.map(p => (
                <li key={p.uid} className="flex items-center gap-3 rounded-xl bg-white/60 border border-white/80 px-3 py-2.5">
                  <ProviderIcon providerId={p.provider.id} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{p.provider.name}</p>
                    <p className="text-xs text-gray-500 truncate">{p.display}</p>
                  </div>
                  <button
                    onClick={() => handleDisconnect(p)}
                    className={BTN_DANGER}
                    title={`Disconnect ${p.provider.name}`}
                  >
                    Disconnect
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!hasGoogle && (
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="w-full flex items-center justify-center gap-2.5 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-white/70 hover:bg-gray-50 transition-colors"
            >
              <GoogleLogo />
              Connect Google account
            </button>
          )}
        </Card>

        {/* Change / Set password */}
        <Card title={user?.has_usable_password ? 'Change Password' : 'Set Password'}>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            {pwSuccess && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">Password updated.</div>
            )}
            {pwErrors.filter(e => !e.param).map((e, i) => (
              <div key={i} className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{e.message}</div>
            ))}
            {user?.has_usable_password && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current password</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required className={INPUT} />
                {pwFieldErr('current_password') && <p className="text-xs text-red-600 mt-1">{pwFieldErr('current_password')}</p>}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
              <input type="password" value={newPw1} onChange={e => setNewPw1(e.target.value)} required className={INPUT} />
              {pwFieldErr('new_password') && <p className="text-xs text-red-600 mt-1">{pwFieldErr('new_password')}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
              <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} required className={INPUT} />
              {pwFieldErr('new_password2') && <p className="text-xs text-red-600 mt-1">{pwFieldErr('new_password2')}</p>}
            </div>
            <button type="submit" disabled={pwLoading} className={`w-full ${BTN_PRIMARY} py-2.5 mt-1`}>
              {pwLoading ? 'Updating…' : user?.has_usable_password ? 'Update password' : 'Set password'}
            </button>
          </form>
        </Card>

      </div>
    </div>
  )
}
