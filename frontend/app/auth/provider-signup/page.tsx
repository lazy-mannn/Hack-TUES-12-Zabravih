'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as allauth from '@/lib/allauth'

/**
 * Shown when a Google account has no email associated.
 * In practice this is rare — most Google accounts provide an email.
 */
export default function ProviderSignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<allauth.AllauthError[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors([])
    const res = await allauth.providerSignup(email)
    setLoading(false)

    if (allauth.isAuthenticated(res)) {
      router.push('/hives')
      return
    }
    if (allauth.pendingFlow(res)?.id === allauth.Flows.VERIFY_EMAIL) {
      router.push('/auth/verify-email')
      return
    }
    setErrors(res.errors ?? [{ message: 'Something went wrong.' }])
  }

  const fieldError = (param: string) =>
    errors.find(e => e.param === param)?.message

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl p-8 space-y-6" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.75)", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)" }}>
        <h1 className="text-2xl font-bold text-amber-900">One more step</h1>
        <p className="text-gray-600 text-sm">
          Please provide an email address to complete your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.filter(e => !e.param).map((e, i) => (
            <p key={i} className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{e.message}</p>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {fieldError('email') && <p className="text-xs text-red-600 mt-1">{fieldError('email')}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading ? 'Continuing…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
