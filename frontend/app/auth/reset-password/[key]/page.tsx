'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import * as allauth from '@/lib/allauth'

export default function ResetPasswordPage() {
  const params = useParams<{ key: string }>()
  // useParams may return percent-encoded segments; decode so signing.loads() can split on ':'
  const key = decodeURIComponent(params.key)
  const router = useRouter()

  const [keyValid, setKeyValid] = useState<boolean | null>(null)
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')
  const [errors, setErrors] = useState<allauth.AllauthError[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Key is passed via X-Password-Reset-Key header (not query param)
    allauth.getPasswordReset(key).then(res => {
      setKeyValid(res.status === 200)
    })
  }, [key])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors([])

    if (password1 !== password2) {
      setErrors([{ param: 'password2', message: 'Passwords do not match.' }])
      return
    }

    setLoading(true)
    // Only send key + password — no password2 in the API
    const res = await allauth.resetPassword(key, password1)
    setLoading(false)

    if (res.status === 200 || res.status === 401) {
      router.push('/auth/login')
    } else {
      setErrors(res.errors ?? [{ message: 'Reset failed. The link may have expired.' }])
    }
  }

  const fieldError = (param: string) =>
    errors.find(e => e.param === param)?.message

  const globalErrors = errors.filter(e => !e.param)

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255, 255, 255, 0.75)',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)',
  }

  if (keyValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Validating link…</p>
      </div>
    )
  }

  if (!keyValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl p-8 text-center space-y-4" style={cardStyle}>
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-amber-900">Link invalid or expired</h1>
          <a href="/auth/reset-password" className="text-sm text-amber-700 hover:underline">Request a new one</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl p-8 space-y-6" style={cardStyle}>
        <h1 className="text-2xl font-bold text-amber-900">Set new password</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {globalErrors.map((e, i) => (
            <p key={i} className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{e.message}</p>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password1}
              onChange={e => setPassword1(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white/80"
            />
            {fieldError('password') && <p className="text-xs text-red-600 mt-1">{fieldError('password')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white/80"
            />
            {fieldError('password2') && <p className="text-xs text-red-600 mt-1">{fieldError('password2')}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
