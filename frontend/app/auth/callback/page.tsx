'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as allauth from '@/lib/allauth'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    if (error) return

    allauth.getSession().then(res => {
      if (allauth.isAuthenticated(res)) {
        router.push('/hives')
        return
      }
      const flow = allauth.pendingFlow(res)
      if (flow?.id === allauth.Flows.PROVIDER_SIGNUP) {
        router.push('/auth/provider-signup')
        return
      }
      if (flow?.id === allauth.Flows.VERIFY_EMAIL) {
        router.push('/auth/verify-email')
        return
      }
      router.push('/auth/login')
    })
  }, [error, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl p-8 text-center space-y-4" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.75)", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.90), 0 24px 48px rgba(0,0,0,0.08)" }}>
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-amber-900">Sign-in failed</h1>
          <p className="text-gray-600 text-sm">{error}</p>
          <a href="/auth/login" className="inline-block text-sm text-amber-700 hover:underline">
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Completing sign-in…</p>
    </div>
  )
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Completing sign-in…</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
