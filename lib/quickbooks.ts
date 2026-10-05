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

// The product/service the sale is booked against, by name, matching what
// already exists in that company's books ("Day Pass", "Event / Conference
// Rm Fee", "Conference Room Fee"). Creating one is the fallback, not the
// intent: a name that doesn't match an existing item starts a brand new
// line in the Sales by Product/Service report and quietly splits the
// history, so it's logged loudly (Caroline, 2026-09-25).
async function findOrCreateItem(realmId: string, accessToken: string, itemName: string) {
  const safeName = itemName.replace(/'/g, "\\'")
  const query = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${safeName}'`)
  const result = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)

  if (result.QueryResponse?.Item?.length > 0) {
    return result.QueryResponse.Item[0]
  }

  console.warn(`[qb] No product/service named "${itemName}" in realm ${realmId} — creating it. Check the name matches the books, or this starts a new revenue line.`)
  const incomeAccount = await findIncomeAccount(realmId, accessToken)

  const newItem = await qbFetch('POST', '/item', realmId, accessToken, {
    Name: itemName,
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

  // Create them under their plain name, the way every customer already in
  // these books is named. We used to always write `Name (email)` because
  // QuickBooks rejects a duplicate display name outright, which would have
  // lost the receipt — but that only happens on an actual clash, so hold the
  // email suffix back for exactly that case. Caroline spotted the mismatch
  // on the first real production receipt (2026-09-28); the email was always
  // set properly on the record either way, it just also cluttered the name.
  const base = {
    PrimaryEmailAddr: { Address: email },
    PrimaryPhone: { FreeFormNumber: phone },
  }
  try {
    const newCustomer = await qbFetch('POST', '/customer', realmId, accessToken, {
      DisplayName: name,
      ...base,
    })
    return newCustomer.Customer
  } catch (err) {
    // Almost always QuickBooks' "Duplicate Name Exists" (6240): someone else
    // in the books is already called this. Retry with the email appended,
    // which is unique by definition, rather than dropping the sale.
    console.warn('[quickbooks] Plain customer name rejected, retrying with email suffix:', name, err)
    const newCustomer = await qbFetch('POST', '/customer', realmId, accessToken, {
      DisplayName: `${name} (${email})`,
      ...base,
    })
    return newCustomer.Customer
  }
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
    /** QuickBooks product/service to book against, e.g. "Day Pass". Comes
     *  from the location row, since the names differ per entity. */
    itemName: string
    /** What the receipt line reads, e.g. "Day Pass — Friday, October 2". */
    description: string
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

  const item = await findOrCreateItem(tokens.realm_id, accessToken, details.itemName)

  const receipt = await qbFetch('POST', '/salesreceipt', tokens.realm_id, accessToken, {
    CustomerRef: { value: customer.Id },
    // Fills the receipt's own Email field. Nothing is sent from QuickBooks
    // (the customer already got our confirmation via Resend), it just means
    // the address is there if anyone ever wants to resend from the books.
    BillEmail: { Address: details.email },
    Line: [
      {
        Amount: details.amount,
        DetailType: 'SalesItemLineDetail',
        Description: details.description,
        SalesItemLineDetail: {
          ItemRef: { value: item.Id, name: item.Name },
          Qty: 1,
          UnitPrice: details.amount,
        },
      },
    ],
    PrivateNote: `Booked via BizHaus — ${details.roomName}, ${details.date}, ${details.time}`,
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

  // Sales receipts void with ?include=void + sparse — NOT ?operation=void
  // (that's the invoice/payment form). Using operation=void made QB reject
  // every day-pass cancellation with "can't void this credit card amount"
  // (caught in the first real test cancel, 2026-09-15).
  const voided = await qbFetch('POST', '/salesreceipt?include=void', tokens.realm_id, accessToken, {
    Id: receiptId,
    SyncToken: syncToken,
    sparse: true,
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

// ---------------------------------------------------------------------------
// Stripe's processing fee
//
// The books recorded the gross sale and nothing else, so QuickBooks said
// $195 while the bank received $189.04 and somebody had to account for the
// difference by hand on every single transaction (Caroline, 2026-10-05).
//
// The fee is booked as an expense paid out of Undeposited Funds, which is
// where the sale already lands. That leaves Undeposited Funds holding the
// net, exactly what Stripe deposits, so the books match the bank with no
// new accounts beyond the expense category itself.
//
// One fee per *payment*, not per receipt: a five day pass is five $39
// receipts but a single $195 charge carrying a single fee.
// ---------------------------------------------------------------------------

const STRIPE_FEE_ACCOUNT_NAME = 'Stripe Fee'

async function findOrCreateExpenseAccount(realmId: string, accessToken: string, name: string) {
  const safeName = name.replace(/'/g, "\\'")
  const query = encodeURIComponent(`SELECT * FROM Account WHERE Name = '${safeName}'`)
  const result = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)

  if (result.QueryResponse?.Account?.length > 0) {
    return result.QueryResponse.Account[0]
  }

  console.warn(`[qb] No account named "${name}" in realm ${realmId} — creating it.`)
  const created = await qbFetch('POST', '/account', realmId, accessToken, {
    Name: name,
    AccountType: 'Expense',
    // Where QuickBooks files merchant processing fees by convention, so this
    // lands somewhere a bookkeeper expects rather than a generic bucket.
    AccountSubType: 'BankCharges',
  })
  return created.Account
}

async function findUndepositedFunds(realmId: string, accessToken: string) {
  const query = encodeURIComponent("SELECT * FROM Account WHERE AccountSubType = 'UndepositedFunds'")
  const result = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)
  const account = result.QueryResponse?.Account?.[0]
  if (!account) {
    throw new Error('QB_NO_UNDEPOSITED_FUNDS: no Undeposited Funds account in this company file')
  }
  return account
}

/**
 * Books one Stripe processing fee. Idempotent: the payment intent id goes in
 * DocNumber, and an existing purchase carrying it means the fee is already
 * recorded. That matters because the booking route and the Stripe webhook
 * both run this path with no guaranteed ordering, the same race the receipts
 * themselves already guard against.
 *
 * Returns null rather than throwing on anything recoverable. A missing fee
 * is a bookkeeping correction; a thrown error here would fail a booking the
 * customer has already paid for.
 */
export async function recordProcessingFee(
  locationId: string,
  details: { paymentIntentId: string; amount: number; description: string }
) {
  if (!(details.amount > 0)) return null

  const tokens = await getTokens(locationId)
  if (!tokens) {
    console.error('[qb] No QB tokens found for location:', locationId)
    return null
  }

  try {
    const accessToken = await refreshIfNeeded(tokens)

    const safeDoc = details.paymentIntentId.replace(/'/g, "\\'")
    const existing = await qbFetch(
      'GET',
      `/query?query=${encodeURIComponent(`SELECT * FROM Purchase WHERE DocNumber = '${safeDoc}'`)}`,
      tokens.realm_id,
      accessToken
    )
    if (existing.QueryResponse?.Purchase?.length > 0) {
      return existing.QueryResponse.Purchase[0]
    }

    const [feeAccount, undeposited] = await Promise.all([
      findOrCreateExpenseAccount(tokens.realm_id, accessToken, STRIPE_FEE_ACCOUNT_NAME),
      findUndepositedFunds(tokens.realm_id, accessToken),
    ])

    const purchase = await qbFetch('POST', '/purchase', tokens.realm_id, accessToken, {
      PaymentType: 'Cash',
      AccountRef: { value: undeposited.Id, name: undeposited.Name },
      // Stripe's own id, so the fee can be traced back to the charge and so
      // this stays idempotent across the route/webhook race.
      DocNumber: details.paymentIntentId,
      PrivateNote: details.description,
      TxnDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
      Line: [
        {
          Amount: details.amount,
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: details.description,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: feeAccount.Id, name: feeAccount.Name },
          },
        },
      ],
    })

    return purchase.Purchase
  } catch (err) {
    console.error('[qb] Could not record Stripe fee:', err instanceof Error ? err.message : err)
    return null
  }
}
