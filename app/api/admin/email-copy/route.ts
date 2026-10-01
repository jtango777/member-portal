import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ALL_COPY_FIELDS, DEFAULT_COPY, fillTags } from '@/lib/emailCopy'
import { clearSettingsCache, getEmailCopy } from '@/lib/settings'
import { dayPassCancellationEmailHtml } from '@/lib/email'

// Reading and saving the editable wording in customer emails, plus a preview
// so nobody has to send themselves a real email to see what they changed
// (Caroline, 2026-10-01).

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET() {
  if (!await assertAdmin()) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  return NextResponse.json({ copy: await getEmailCopy(), defaults: DEFAULT_COPY })
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { copy } = await request.json()
  if (!copy || typeof copy !== 'object') {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  }

  // Only keys we know about, only strings, and only where the text actually
  // differs from the default. Storing nothing for an unchanged field means a
  // later wording change in the code reaches everyone who never edited it.
  const known = new Set(ALL_COPY_FIELDS.map(f => f.key))
  const overrides: Record<string, string> = {}
  for (const [key, value] of Object.entries(copy)) {
    if (!known.has(key) || typeof value !== 'string') continue
    const text = value.trim()
    if (text && text !== DEFAULT_COPY[key].trim()) overrides[key] = text
  }

  const { error } = await createAdminClient()
    .from('app_settings')
    .upsert({ key: 'email_copy', value: overrides, updated_at: new Date().toISOString(), updated_by: user.id })

  if (error) {
    console.error('[email-copy] save failed:', error.message)
    return NextResponse.json({ error: 'Could not save. Nothing was changed.' }, { status: 500 })
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true, overrides: Object.keys(overrides).length })
}

// A rendered preview of one template, using the copy being edited rather than
// what is saved, so you see the change before committing to it.
export async function PUT(request: Request) {
  if (!await assertAdmin()) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { templateId, copy } = await request.json()
  const merged = { ...DEFAULT_COPY, ...(copy ?? {}) }
  const tags = { firstName: 'Alex', location: 'El Segundo', date: 'Friday, October 9, 2026', room: 'Small', amount: '$32.50' }

  // Only the cancellation email is rendered from a pure function today, so it
  // is the one we can preview without sending. The others build their HTML
  // inside their send function; previewing those means lifting the HTML out
  // first, which is a bigger change than this screen is worth right now.
  if (templateId === 'day_pass_cancellation') {
    return NextResponse.json({
      html: dayPassCancellationEmailHtml({
        guestName: 'Alex Rivera',
        location: 'El Segundo',
        dates: ['Friday, October 9, 2026'],
        remainingDates: [],
        refundAmount: '$39.00',
        confirmationNumber: 'ABC12345',
      }, merged),
    })
  }

  // Everything else previews as the lines themselves, with the tags filled
  // in, which is what is actually editable.
  const fields = ALL_COPY_FIELDS.filter(f => f.key.startsWith(templateId + '.'))
  return NextResponse.json({
    lines: fields.map(f => ({ label: f.label, text: fillTags(merged[f.key], tags) })),
  })
}
