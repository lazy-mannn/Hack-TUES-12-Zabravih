'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as allauth from '@/lib/allauth'

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')
  const [errors, setErrors] = useState<allauth.AllauthError[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { allauth.getSession() }, [])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors([])

    if (password1 !== password2) {
      setErrors([{ param: 'password2', message: 'Passwords do not match.' }])
      return
    }

    setLoading(true)
    const res = await allauth.signup(email, password1, password2)
    setLoading(false)

    const flow = allauth.pendingFlow(res)
    if (flow?.id === allauth.Flows.VERIFY_EMAIL) {
      router.push('/auth/verify-email')
      return
    }
    if (allauth.isAuthenticated(res)) {
      router.push('/hives')
      return
    }
    setErrors(res.errors ?? [{ message: 'Signup failed. Please try again.' }])
  }

  function handleGoogleSignup() {
    allauth.redirectToGoogle(`${window.location.origin}/auth/callback`)
  }

  const fieldError = (param: string) =>
    errors.find(e => e.param === param)?.message

  const globalErrors = errors.filter(e => !e.param)

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl p-8 space-y-6" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.75)", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)" }}>
        <h1 className="text-2xl font-bold text-amber-900">Create your account</h1>

        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="flex-1 h-px bg-gray-200" />
          or
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {globalErrors.map((e, i) => (
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password1}
              onChange={e => setPassword1(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {fieldError('password') && <p className="text-xs text-red-600 mt-1">{fieldError('password')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {fieldError('password2') && <p className="text-xs text-red-600 mt-1">{fieldError('password2')}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <a href="/auth/login" className="text-amber-700 font-medium hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}
