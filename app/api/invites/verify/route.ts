import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ valid: false })

  const admin = createAdminClient()
  const { data } = await admin
    .from('permitted_emails')
    .select('email, accepted_at, default_location_id')
    .eq('invite_token', token)
    .single()

  if (!data || data.accepted_at) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: true, email: data.email, default_location_id: data.default_location_id })
}
