'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import * as allauth from '@/lib/allauth'

export default function ConfirmEmailPage() {
  const params = useParams<{ key: string }>()
  // useParams may return percent-encoded segments; decode so signing.loads() can split on ':'
  const key = decodeURIComponent(params.key)
  const router = useRouter()

  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [keyValid, setKeyValid] = useState<boolean | null>(null)
  const [status, setStatus] = useState<'idle' | 'confirming' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Key is passed via X-Email-Verification-Key header (not a query param)
    allauth.getEmailVerification(key).then(res => {
      if (res.status === 200) {
        setVerificationEmail((res.data as { email?: string })?.email ?? null)
        setKeyValid(true)
      } else {
        setKeyValid(false)
        setErrorMsg(res.errors?.[0]?.message ?? 'This link is invalid or has expired.')
      }
    })
  }, [key])

  async function confirm() {
    setStatus('confirming')
    const res = await allauth.verifyEmail(key)
    if (allauth.isAuthenticated(res)) {
      router.push('/hives')
      return
    }
    // Verified but session not established — go to login
    if (res.status === 200 || res.status === 401) {
      router.push('/auth/login')
      return
    }
    setErrorMsg(res.errors?.[0]?.message ?? 'Verification failed.')
    setStatus('error')
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255, 255, 255, 0.75)',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)',
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl px-8 py-10 text-center space-y-6" style={cardStyle}>
        <div className="text-5xl">✉️</div>
        <h1 className="text-2xl font-bold text-amber-900">Confirm your email</h1>

        {keyValid === null && (
          <p className="text-gray-500">Validating link…</p>
        )}

        {keyValid === false && (
          <>
            <p className="text-red-600">{errorMsg}</p>
            <a href="/auth/signup" className="text-sm text-amber-700 hover:underline">Back to signup</a>
          </>
        )}

        {keyValid === true && status === 'idle' && (
          <>
            {verificationEmail && (
              <p className="text-gray-600">
                Confirm <span className="font-medium">{verificationEmail}</span> as your email address.
              </p>
            )}
            <button
              onClick={confirm}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
            >
              Confirm email
            </button>
          </>
        )}

        {status === 'confirming' && (
          <p className="text-gray-500">Confirming…</p>
        )}

        {status === 'error' && (
          <>
            <p className="text-red-600">{errorMsg}</p>
            <a href="/auth/signup" className="text-sm text-amber-700 hover:underline">Back to signup</a>
          </>
        )}
      </div>
    </div>
  )
}
