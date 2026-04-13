'use server'

import { redirect } from 'next/navigation'
import { postRegisterHive, patchHive } from '@/lib/django'

export type RegisterState = { error: string } | null
export type EditState = { error: string } | null

export async function registerHive(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = (formData.get('name') as string).trim()
  const location = (formData.get('location') as string).trim()
  const macaddress = (formData.get('macaddress') as string).trim()
  const address = ((formData.get('address') as string) ?? '').trim()
  const latitude = ((formData.get('latitude') as string) ?? '').trim() || undefined
  const longitude = ((formData.get('longitude') as string) ?? '').trim() || undefined

  try {
    await postRegisterHive({ name, location, macaddress, address, latitude, longitude })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong' }
  }

  redirect('/hives')
}

export async function updateHive(
  id: number,
  _prevState: EditState,
  formData: FormData,
): Promise<EditState> {
  const name = (formData.get('name') as string).trim()
  const location = (formData.get('location') as string).trim()
  const address = ((formData.get('address') as string) ?? '').trim()
  const latitude = ((formData.get('latitude') as string) ?? '').trim() || null
  const longitude = ((formData.get('longitude') as string) ?? '').trim() || null

  try {
    await patchHive(id, { name, location, address, latitude, longitude })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong' }
  }

  redirect(`/hives/${id}`)
}
