// Server-only module — never imported from client components.
// All calls go from the Next.js server to Django at localhost.

const DJANGO_URL = process.env.DJANGO_URL!
const DJANGO_API_KEY = process.env.DJANGO_API_KEY!

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': DJANGO_API_KEY,
  }
}

export type Hive = {
  id: number
  name: string
  location: string
}

export type HiveDetail = {
  id: number
  name: string
  location: string
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
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Django /api/ returned ${res.status}`)
  return res.json()
}

export async function fetchHiveDetail(id: number): Promise<HiveDetail> {
  const res = await fetch(`${DJANGO_URL}/api/${id}/`, {
    headers: headers(),
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
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Django /api/${id}/?displayed_time=${period} returned ${res.status}`)
  return res.json()
}

export async function postRegisterHive(data: {
  name: string
  location: string
  macaddress: string
}): Promise<void> {
  const res = await fetch(`${DJANGO_URL}/api/register/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = Object.entries(body)
      .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
      .join(' | ')
    throw new Error(msg || `Server returned ${res.status}`)
  }
}
