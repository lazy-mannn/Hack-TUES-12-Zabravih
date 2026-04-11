import { cookies } from 'next/headers'
import AccountDropdown from './AccountDropdown'

interface AllauthUser {
  id: number
  email: string
  display: string
}

async function getCurrentUser(): Promise<AllauthUser | null> {
  const store = await cookies()
  const cookieHeader = store.getAll().map(c => `${c.name}=${c.value}`).join('; ')

  try {
    const res = await fetch(
      `${process.env.DJANGO_URL}/_allauth/browser/v1/auth/session`,
      { headers: { cookie: cookieHeader }, cache: 'no-store' },
    )
    const data = await res.json()
    return data?.data?.user ?? null
  } catch {
    return null
  }
}

export default async function UserMenu() {
  const user = await getCurrentUser()
  if (!user) return null

  return <AccountDropdown email={user.email} />
}
