/**
 * Client-side allauth headless API wrapper (browser mode).
 *
 * All functions are called from the browser. Django manages the session via
 * an httpOnly `sessionid` cookie — JavaScript never touches it directly.
 * CSRF is handled via the `csrftoken` cookie that Django sets on GET /auth/session.
 */

const BASE = '/_allauth/browser/v1'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AllauthError {
  param?: string
  message: string
  code?: string
}

export interface AllauthFlow {
  id: string
  is_pending?: boolean
}

export interface AllauthUser {
  id: number
  email: string
  display: string
  has_usable_password?: boolean
}

export interface EmailAddress {
  email: string
  primary: boolean
  verified: boolean
}

export interface ProviderAccount {
  uid: string
  display: string
  provider: { id: string; name: string }
}

export interface AllauthResponse {
  status: number
  data?: {
    user?: AllauthUser
    flows?: AllauthFlow[]
    [key: string]: unknown
  }
  errors?: AllauthError[]
  meta?: {
    is_authenticated?: boolean
    session_token?: string
  }
}

// Flow IDs returned by allauth
export const Flows = {
  LOGIN:              'login',
  SIGNUP:             'signup',
  VERIFY_EMAIL:       'verify_email',
  PASSWORD_RESET:     'password_reset',
  PROVIDER_SIGNUP:    'provider_signup',
  PROVIDER_REDIRECT:  'provider_redirect',
  LOGIN_BY_CODE:      'login_by_code',
} as const

// ── CSRF ───────────────────────────────────────────────────────────────────────

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/)
  return match ? match[1] : ''
}

// ── Core fetch ─────────────────────────────────────────────────────────────────

async function request(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<AllauthResponse> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrfToken(),
    ...extraHeaders,
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  return res.json()
}

// ── Auth session ───────────────────────────────────────────────────────────────

/** Fetches the current auth state. Also causes Django to set the csrftoken cookie. */
export function getSession(): Promise<AllauthResponse> {
  return request('GET', '/auth/session')
}

// ── Email + password ───────────────────────────────────────────────────────────

export function login(email: string, password: string): Promise<AllauthResponse> {
  return request('POST', '/auth/login', { email, password })
}

export function signup(email: string, password1: string, password2: string): Promise<AllauthResponse> {
  return request('POST', '/auth/signup', { email, password: password1, password2 })
}

export function logout(): Promise<AllauthResponse> {
  return request('DELETE', '/auth/session')
}

// ── Email verification ─────────────────────────────────────────────────────────

/** Validates a verification link key. Key is passed as a custom header. */
export function getEmailVerification(key: string): Promise<AllauthResponse> {
  return request('GET', '/auth/email/verify', undefined, { 'X-Email-Verification-Key': key })
}

/** Confirms email verification. Key is sent in the POST body. */
export function verifyEmail(key: string): Promise<AllauthResponse> {
  return request('POST', '/auth/email/verify', { key })
}

// ── Password reset ─────────────────────────────────────────────────────────────

export function requestPasswordReset(email: string): Promise<AllauthResponse> {
  return request('POST', '/auth/password/request', { email })
}

/** Validates a password reset link key. Key is passed as a custom header. */
export function getPasswordReset(key: string): Promise<AllauthResponse> {
  return request('GET', '/auth/password/reset', undefined, { 'X-Password-Reset-Key': key })
}

/** Resets the password. Only `key` and `password` are sent — no password2. */
export function resetPassword(key: string, password: string): Promise<AllauthResponse> {
  return request('POST', '/auth/password/reset', { key, password })
}

// ── Account: password ──────────────────────────────────────────────────────────

export function changePassword(currentPassword: string, newPassword: string): Promise<AllauthResponse> {
  return request('POST', '/account/password/change', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

// ── Account: email addresses ───────────────────────────────────────────────────

export function getEmailAddresses(): Promise<AllauthResponse> {
  return request('GET', '/account/email')
}

export function addEmail(email: string): Promise<AllauthResponse> {
  return request('POST', '/account/email', { email })
}

export function deleteEmail(email: string): Promise<AllauthResponse> {
  return request('DELETE', '/account/email', { email })
}

export function markEmailAsPrimary(email: string): Promise<AllauthResponse> {
  return request('PATCH', '/account/email', { email, primary: true })
}

export function requestEmailVerification(email: string): Promise<AllauthResponse> {
  return request('PUT', '/account/email', { email })
}

// ── Social accounts (OAuth) ────────────────────────────────────────────────────

/** Submit a hidden form POST to initiate an OAuth provider flow. */
function providerRedirect(process: 'login' | 'connect', callbackUrl: string): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = `${BASE}/auth/provider/redirect`

  const fields: Record<string, string> = {
    provider: 'google',
    process,
    callback_url: callbackUrl,
    csrfmiddlewaretoken: getCsrfToken(),
  }

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}

/**
 * Redirects the browser to the Google OAuth consent screen (login/signup flow).
 * Uses a form POST so the CSRF token is included automatically.
 */
export function redirectToGoogle(callbackUrl: string): void {
  providerRedirect('login', callbackUrl)
}

/**
 * Redirects to Google OAuth to connect an account to the currently signed-in user.
 */
export function connectToGoogle(callbackUrl: string): void {
  providerRedirect('connect', callbackUrl)
}

/** Complete OAuth signup when the provider did not supply an email. */
export function providerSignup(email: string): Promise<AllauthResponse> {
  return request('POST', '/auth/provider/signup', { email })
}

/** List connected social accounts. */
export function getProviderAccounts(): Promise<AllauthResponse> {
  return request('GET', '/account/providers')
}

/** Disconnect a social account. */
export function disconnectProviderAccount(providerId: string, accountUid: string): Promise<AllauthResponse> {
  return request('DELETE', '/account/providers', { provider: providerId, account: accountUid })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns true when the response indicates full authentication. */
export function isAuthenticated(res: AllauthResponse): boolean {
  return res.status === 200 && res.meta?.is_authenticated === true
}

/** Returns the first pending flow from a response, if any. */
export function pendingFlow(res: AllauthResponse): AllauthFlow | undefined {
  return res.data?.flows?.find(f => f.is_pending)
}
