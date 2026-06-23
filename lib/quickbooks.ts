import { createAdminClient } from '@/lib/supabase/server'

const QB_BASE = process.env.QB_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com'

const QB_MINOR_VERSION = '73'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

interface QBTokenRow {
  id: string
  location_id: string
  realm_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

async function getTokens(locationId: string): Promise<QBTokenRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('qb_tokens')
    .select('*')
    .eq('location_id', locationId)
    .single()
  return data
}

async function refreshIfNeeded(tokens: QBTokenRow): Promise<string> {
  if (new Date(tokens.expires_at) > new Date(Date.now() + 60_000)) {
    return tokens.access_token
  }

  const admin = createAdminClient()

  // Mark token as refreshing to prevent concurrent refresh race condition
  const { data: current } = await admin
    .from('qb_tokens')
    .select('refresh_token, expires_at')
    .eq('id', tokens.id)
    .single()

  // If another request already refreshed it, use the new token
  if (current && new Date(current.expires_at) > new Date(Date.now() + 60_000)) {
    const { data: updated } = await admin
      .from('qb_tokens')
      .select('access_token')
      .eq('id', tokens.id)
      .single()
    return updated!.access_token
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current?.refresh_token ?? tokens.refresh_token,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`QB token refresh failed: ${JSON.stringify(data)}`)

  await admin
    .from('qb_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokens.id)

  return data.access_token
}

async function qbFetch(
  method: string,
  path: string,
  realmId: string,
  accessToken: string,
  body?: unknown
) {
  const separator = path.includes('?') ? '&' : '?'
  const url = `${QB_BASE}/v3/company/${realmId}${path}${separator}minorversion=${QB_MINOR_VERSION}`

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`QB API error: ${JSON.stringify(data)}`)
  return data
}

async function findOrCreateItem(realmId: string, accessToken: string) {
  const query = encodeURIComponent("SELECT * FROM Item WHERE Name = 'Room Booking'")
  const result = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)

  if (result.QueryResponse?.Item?.length > 0) {
    return result.QueryResponse.Item[0]
  }

  const newItem = await qbFetch('POST', '/item', realmId, accessToken, {
    Name: 'Room Booking',
    Type: 'Service',
    IncomeAccountRef: { value: '1' },
  })

  return newItem.Item
}

async function findOrCreateCustomer(
  realmId: string,
  accessToken: string,
  name: string,
  email: string,
  phone: string
) {
  const safeEmail = email.replace(/'/g, "\\'")
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${safeEmail}'`)
  const result = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)

  if (result.QueryResponse?.Customer?.length > 0) {
    return result.QueryResponse.Customer[0]
  }

  const newCustomer = await qbFetch('POST', '/customer', realmId, accessToken, {
    DisplayName: `${name} (${email})`,
    PrimaryEmailAddr: { Address: email },
    PrimaryPhone: { FreeFormNumber: phone },
  })

  return newCustomer.Customer
}

export async function createSalesReceipt(
  locationId: string,
  details: {
    guestName: string
    email: string
    phone: string
    roomName: string
    date: string
    time: string
    amount: number
  }
) {
  const tokens = await getTokens(locationId)
  if (!tokens) {
    console.error('[qb] No QB tokens found for location:', locationId)
    return null
  }

  const accessToken = await refreshIfNeeded(tokens)

  const customer = await findOrCreateCustomer(
    tokens.realm_id,
    accessToken,
    details.guestName,
    details.email,
    details.phone
  )

  const item = await findOrCreateItem(tokens.realm_id, accessToken)

  const receipt = await qbFetch('POST', '/salesreceipt', tokens.realm_id, accessToken, {
    CustomerRef: { value: customer.Id },
    Line: [
      {
        Amount: details.amount,
        DetailType: 'SalesItemLineDetail',
        Description: `Room Booking: ${details.roomName} — ${details.date}, ${details.time}`,
        SalesItemLineDetail: {
          ItemRef: { value: item.Id, name: item.Name },
          Qty: 1,
          UnitPrice: details.amount,
        },
      },
    ],
    PrivateNote: `Booking via BizHaus — ${details.roomName}, ${details.date}, ${details.time}`,
  })

  return receipt.SalesReceipt
}
