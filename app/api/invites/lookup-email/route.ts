import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ status: 'not_found' })

  const admin = createAdminClient()
  const { data } = await admin
    .from('permitted_emails')
    .select('email, accepted_at')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!data) return NextResponse.json({ status: 'not_found' })
  if (data.accepted_at) return NextResponse.json({ status: 'already_registered' })
  return NextResponse.json({ status: 'ok', email: data.email })
}
