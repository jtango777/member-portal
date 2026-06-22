import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')
  if (!locationId) return NextResponse.json({ error: 'Missing location_id' }, { status: 400 })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/qb/callback`

  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID!,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: locationId,
  })

  return NextResponse.redirect(`${AUTH_URL}?${params.toString()}`)
}
