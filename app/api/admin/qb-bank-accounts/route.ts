import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { clearSettingsCache, getQbBankAccounts } from '@/lib/settings'
import { qbQuery } from '@/lib/quickbooks'

// Which QuickBooks bank account each entity's Stripe payouts deposit into.
//
// Typed in rather than hardcoded because nobody on this side can read the
// chart of accounts: Caroline's QuickBooks role cannot open it, and the
// three companies name their accounts differently (2026-10-06).

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET() {
  if (!await assertAdmin()) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const accounts = await getQbBankAccounts()

  // Offer the real account names from each connected company, so nobody has
  // to type a name from memory and get it subtly wrong.
  const { data: locations } = await createAdminClient().from('locations').select('id, name')
  const choices: Record<string, string[]> = {}
  for (const loc of locations ?? []) {
    try {
      const result = await qbQuery(loc.id, "SELECT Name FROM Account WHERE AccountType = 'Bank' AND Active = true")
      choices[loc.id] = (result?.QueryResponse?.Account ?? []).map((a: { Name: string }) => a.Name)
    } catch {
      // Not connected, or QuickBooks is unreachable. The box still accepts
      // a typed name; it just cannot offer a list.
      choices[loc.id] = []
    }
  }

  return NextResponse.json({ accounts, choices, locations: locations ?? [] })
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { accounts } = await request.json()
  if (!accounts || typeof accounts !== 'object') {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  }

  const clean: Record<string, string> = {}
  for (const [locationId, raw] of Object.entries(accounts)) {
    if (typeof raw !== 'string') continue
    const name = raw.trim()
    if (name) clean[locationId] = name
  }

  const { error } = await createAdminClient()
    .from('app_settings')
    .upsert({ key: 'qb_bank_accounts', value: clean, updated_at: new Date().toISOString(), updated_by: user.id })

  if (error) {
    console.error('[qb-bank-accounts] save failed:', error.message)
    return NextResponse.json({ error: 'Could not save. Nothing was changed.' }, { status: 500 })
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true })
}
