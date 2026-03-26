'use server'

import { redirect } from 'next/navigation'
import { postRegisterHive } from '@/lib/django'

export type RegisterState = { error: string } | null

export async function registerHive(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = (formData.get('name') as string).trim()
  const location = (formData.get('location') as string).trim()
  const macaddress = (formData.get('macaddress') as string).trim()

  try {
    await postRegisterHive({ name, location, macaddress })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong' }
  }

  redirect('/hives')
}
