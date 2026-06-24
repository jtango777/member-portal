import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Public — needed on the setup-account page before user is logged in
export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('locations').select('id, name').order('name')
  if (error) {
    console.error('[locations] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to load locations.' }, { status: 500 })
  }
  return NextResponse.json(data)
}
