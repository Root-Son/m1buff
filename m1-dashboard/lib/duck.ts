// Duck API client for m1-dashboard
// Keycloak service account (client_credentials) → duck query

const DUCK_URL = process.env.DUCK_URL || 'https://duck.plott.co.kr'
const KC_URL = process.env.KEYCLOAK_URL || 'https://auth.plott.co.kr'
const KC_REALM = 'plott'
const SA_CLIENT_ID = 'plott-sandbox-service-account'
const SA_CLIENT_SECRET = 'ShscGDeRHvrHz9mt3fxe4m5a7U0KQ0Lo'

let cachedToken: { token: string; expiresAt: number } | null = null

async function getServiceToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.token
  }

  const res = await fetch(`${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SA_CLIENT_ID,
      client_secret: SA_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    throw new Error(`SA token error ${res.status}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.token
}

export async function duckQuery(sql: string): Promise<{ columns: string[]; rows: any[] }> {
  const token = await getServiceToken()

  const res = await fetch(`${DUCK_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sql }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Duck query failed: ${res.status} ${text}`)
  }

  return res.json()
}
