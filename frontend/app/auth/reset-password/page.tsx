'use client'

import { useState, useEffect } from 'react'
import * as allauth from '@/lib/allauth'

export default function RequestPasswordResetPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { allauth.getSession() }, [])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await allauth.requestPasswordReset(email)
    setLoading(false)

    // allauth returns 401 with a pending flow on success
    if (res.status === 401 || res.status === 200) {
      setSent(true)
    } else {
      setError(res.errors?.[0]?.message ?? 'Something went wrong.')
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl p-6 sm:p-8 text-center space-y-4" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.75)", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)" }}>
          <div className="text-5xl">📨</div>
          <h1 className="text-2xl font-bold text-amber-900">Email sent</h1>
          <p className="text-gray-600">
            If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
          </p>
          <a href="/auth/login" className="inline-block text-sm text-amber-700 hover:underline">Back to sign in</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl p-6 sm:p-8 space-y-6" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.75)", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)" }}>
        <h1 className="text-2xl font-bold text-amber-900">Reset your password</h1>
        <p className="text-gray-600 text-sm">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <a href="/auth/login" className="block text-center text-sm text-amber-700 hover:underline">
          Back to sign in
        </a>
      </div>
    </div>
  )
}
