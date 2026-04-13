// Server-only module — never imported from client components.
// All calls go from the Next.js server to Django at localhost,
// forwarding the browser's sessionid cookie so Django can authenticate the user.

import { cookies } from 'next/headers'

const DJANGO_URL = process.env.DJANGO_URL!

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies()
  const all = store.getAll()
  const cookieHeader = all.map(c => `${c.name}=${c.value}`).join('; ')
  const csrfToken = all.find(c => c.name === 'csrftoken')?.value ?? ''
  return {
    'Content-Type': 'application/json',
    'Cookie': cookieHeader,
    'X-CSRFToken': csrfToken,
  }
}

export type Hive = {
  id: number
  name: string
  location: string       // user-given nickname
  address: string        // geocoded address
  latitude: string | null
  longitude: string | null
}

export type HiveDetail = {
  id: number
  name: string
  location: string
  address: string
  latitude: string | null
  longitude: string | null
  exists_since: string
  measurements: string[]
}

export type AggregatedMeasurement = {
  bucket_start: string
  bucket_end: string
  avg_temperature: number
  avg_humidity: number
  avg_co2_level: number
  avg_battery_level: number
  sample_count: number
  dominant_state: "QNP" | "QPNA" | "QPR" | "QPO" | null
}

export type HiveMetrics = {
  hive_id: number
  displayed_time: string
  interval_minutes: number
  aggregated_measurements: AggregatedMeasurement[]
}

export async function fetchHives(): Promise<Hive[]> {
  const res = await fetch(`${DJANGO_URL}/api/`, {
    headers: await authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Django /api/ returned ${res.status}`)
  return res.json()
}

export async function fetchHiveDetail(id: number): Promise<HiveDetail> {
  const res = await fetch(`${DJANGO_URL}/api/${id}/`, {
    headers: await authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Django /api/${id}/ returned ${res.status}`)
  return res.json()
}

export async function fetchHiveMetrics(
  id: number,
  period: '24h' | '7d' | '14d',
): Promise<HiveMetrics> {
  const res = await fetch(`${DJANGO_URL}/api/${id}/?displayed_time=${period}`, {
    headers: await authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Django /api/${id}/?displayed_time=${period} returned ${res.status}`)
  return res.json()
}

export async function postRegisterHive(data: {
  name: string
  location: string
  macaddress: string
  address?: string
  latitude?: string
  longitude?: string
}): Promise<void> {
  const res = await fetch(`${DJANGO_URL}/api/register/`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = Object.entries(body)
      .map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : String(v)
        return `${k}: ${val}`
      })
      .join(' | ')
    throw new Error(msg || `Server returned ${res.status}`)
  }
}

export async function patchHive(id: number, data: {
  name?: string
  location?: string
  address?: string
  latitude?: string | null
  longitude?: string | null
}): Promise<void> {
  const res = await fetch(`${DJANGO_URL}/api/${id}/edit/`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = Object.entries(body)
      .map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : String(v)
        return `${k}: ${val}`
      })
      .join(' | ')
    throw new Error(msg || `Server returned ${res.status}`)
  }
}
