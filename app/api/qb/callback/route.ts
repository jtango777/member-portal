import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const locationId = searchParams.get('state')

  if (!code || !realmId || !locationId) {
    return NextResponse.json({ error: 'Missing OAuth parameters' }, { status: 400 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/qb/callback`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: 'Token exchange failed', details: data }, { status: 500 })
  }

  const admin = createAdminClient()
  await admin
    .from('qb_tokens')
    .upsert({
      location_id: locationId,
      realm_id: realmId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'location_id' })

  const url = new URL('/dashboard/admin', request.url)
  url.searchParams.set('qb', 'connected')
  return NextResponse.redirect(url.toString())
}
