import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const admin = createAdminClient()

  // Guard: only allowed when no admins exist
  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', true)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Admin already exists.' }, { status: 403 })
  }

  const { name, email, password, companyName } = await request.json()
  if (!name || !email || !password || !companyName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Create company
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .insert({ name: companyName, monthly_hours_allotment: 0 })
    .select()
    .single()

  if (companyErr) {
    console.error('[admin-setup] Company create error:', companyErr.message)
    return NextResponse.json({ error: 'Setup failed. Please try again.' }, { status: 500 })
  }

  // Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr) {
    console.error('[admin-setup] Auth create error:', authErr.message)
    return NextResponse.json({ error: 'Setup failed. Please try again.' }, { status: 500 })
  }

  // Create profile as admin
  await admin.from('profiles').insert({
    id:         authData.user!.id,
    company_id: company.id,
    full_name:  name.trim(),
    is_admin:   true,
  })

  return NextResponse.json({ ok: true })
}
