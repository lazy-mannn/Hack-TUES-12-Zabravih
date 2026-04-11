'use client'

import { useRouter } from 'next/navigation'
import * as allauth from '@/lib/allauth'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await allauth.logout()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-lg text-amber-800 border border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 transition-all"
    >
      Sign out
    </button>
  )
}
