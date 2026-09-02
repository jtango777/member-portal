import { createAdminClient } from '@/lib/supabase/server'

const QB_BASE = process.env.QB_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com'

const QB_MINOR_VERSION = '73'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

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
  if (!res.ok) {
    if (data.error === 'invalid_grant') {
      await admin
        .from('qb_tokens')
        .update({ needs_reconnect: true, updated_at: new Date().toISOString() })
        .eq('id', tokens.id)
      throw new Error('QB_NEEDS_RECONNECT')
    }
    throw new Error(`QB token refresh failed: ${JSON.stringify(data)}`)
  }

  await admin
    .from('qb_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      needs_reconnect: false,
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

// Every QuickBooks company file has its own chart of accounts with its own
// ids — there's no universal "account 1". Look up a real Income account by
// type instead of guessing an id, so this works across every location's
// separate QB company file, not just whichever one happened to have an
// account 1 that was actually Income.
async function findIncomeAccount(realmId: string, accessToken: string) {
  const query = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Income' AND Active = true")
  const result = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)
  const accounts = result.QueryResponse?.Account
  if (!accounts || accounts.length === 0) {
    throw new Error('QB_NO_INCOME_ACCOUNT: no active Income account found in this company file')
  }
  // Prefer the default "Sales of Product Income" / "Services" style account
  // QB ships new companies with, but fall back to the first Income account
  // rather than failing outright.
  return accounts.find((a: any) => a.Name === 'Services') ?? accounts[0]
}

async function findOrCreateItem(realmId: string, accessToken: string) {
  const query = encodeURIComponent("SELECT * FROM Item WHERE Name = 'Room Booking'")
  const result = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)

  if (result.QueryResponse?.Item?.length > 0) {
    return result.QueryResponse.Item[0]
  }

  const incomeAccount = await findIncomeAccount(realmId, accessToken)

  const newItem = await qbFetch('POST', '/item', realmId, accessToken, {
    Name: 'Room Booking',
    Type: 'Service',
    IncomeAccountRef: { value: incomeAccount.Id, name: incomeAccount.Name },
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

// Voids a sales receipt already created by createSalesReceipt above — used
// when a day pass gets self-serve cancelled, so QB's books reflect the
// refund instead of still showing revenue for a day that got cancelled.
// QB's void operation needs the receipt's current SyncToken, not just its
// Id, so this fetches the receipt first rather than assuming the token
// from creation time is still valid.
export async function voidSalesReceipt(locationId: string, receiptId: string) {
  const tokens = await getTokens(locationId)
  if (!tokens) {
    console.error('[qb] No QB tokens found for location:', locationId)
    return null
  }

  const accessToken = await refreshIfNeeded(tokens)

  const current = await qbFetch('GET', `/salesreceipt/${receiptId}`, tokens.realm_id, accessToken)
  const syncToken = current.SalesReceipt.SyncToken

  const voided = await qbFetch('POST', '/salesreceipt?operation=void', tokens.realm_id, accessToken, {
    Id: receiptId,
    SyncToken: syncToken,
  })

  return voided.SalesReceipt
}

export async function disconnectQuickBooks(locationId: string) {
  const tokens = await getTokens(locationId)
  if (!tokens) return

  // Revoke the token at Intuit
  try {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({ token: tokens.refresh_token }),
    })
  } catch (err) {
    console.error('[qb] Token revocation failed (continuing with local cleanup):', err)
  }

  // Remove local tokens
  const admin = createAdminClient()
  await admin.from('qb_tokens').delete().eq('id', tokens.id)
}

export async function getConnectionStatus(locationId: string) {
  const tokens = await getTokens(locationId)
  if (!tokens) return { connected: false, needsReconnect: false }
  return {
    connected: true,
    needsReconnect: !!(tokens as any).needs_reconnect,
    realmId: tokens.realm_id,
  }
}
