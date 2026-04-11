'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import * as allauth from '@/lib/allauth'

export default function ConfirmEmailPage() {
  const { key } = useParams<{ key: string }>()
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'ready' | 'confirming' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    allauth.getEmailVerification(key).then(res => {
      if (res.status === 200 || res.status === 401) {
        setStatus('ready')
      } else {
        setErrorMsg(res.errors?.[0]?.message ?? 'This link is invalid or has expired.')
        setStatus('error')
      }
    })
  }, [key])

  async function confirm() {
    setStatus('confirming')
    const res = await allauth.verifyEmail(key)
    if (allauth.isAuthenticated(res)) {
      router.push('/hives')
    } else {
      setErrorMsg(res.errors?.[0]?.message ?? 'Verification failed.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="text-5xl">✉️</div>
        <h1 className="text-2xl font-bold text-amber-900">Confirm your email</h1>

        {status === 'loading' && (
          <p className="text-gray-500">Validating link…</p>
        )}

        {status === 'ready' && (
          <>
            <p className="text-gray-600">Click below to confirm your email address and activate your account.</p>
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
