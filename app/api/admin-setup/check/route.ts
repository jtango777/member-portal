import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const admin = createAdminClient()
  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', true)
  return NextResponse.json({ allowed: (count ?? 0) === 0 })
}
