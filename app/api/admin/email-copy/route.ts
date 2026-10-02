import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ALL_COPY_FIELDS, DEFAULT_COPY, fillTags } from '@/lib/emailCopy'
import { clearSettingsCache, getEmailCopy } from '@/lib/settings'
import {
  dayPassCancellationEmailHtml,
  standardConfirmationEmail,
  marinaConfirmationEmail,
  wrapLetterEmail,
} from '@/lib/email'
import { DAY_PASS_LOCATIONS_BY_NAME } from '@/lib/locations'

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

  // Previews render through the real email builders, so what is shown here
  // cannot drift from what is sent. The first version printed the raw text
  // instead, which made a perfectly good email look like one run-on blob
  // (Caroline, 2026-10-01).
  const sample = {
    confirmationNumber: 'ABC12345',
    location: 'El Segundo',
    date: 'Friday, October 9, 2026',
    guestName: 'Alex Rivera',
    amountPaid: '$39.00',
  }

  if (templateId === 'day_pass_confirmation') {
    const loc = DAY_PASS_LOCATIONS_BY_NAME['El Segundo']
    return NextResponse.json({
      html: wrapLetterEmail(standardConfirmationEmail('Alex', sample, loc, merged, {
        firstName: 'Alex', location: sample.location, date: sample.date,
      })),
    })
  }

  if (templateId === 'marina_confirmation') {
    const loc = DAY_PASS_LOCATIONS_BY_NAME['Marina del Rey']
    return NextResponse.json({
      html: wrapLetterEmail(marinaConfirmationEmail('Alex', sample, loc, merged)),
    })
  }

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

  // The room emails build their HTML inside their send function, so there is
  // nothing to render without sending one. Show the lines with their tags
  // filled in, which is what is editable.
  const tags = { firstName: 'Alex', room: 'Small', location: 'El Segundo', date: sample.date, amount: '$32.50' }
  const fields = ALL_COPY_FIELDS.filter(f => f.key.startsWith(templateId + '.'))
  return NextResponse.json({
    lines: fields.map(f => ({ label: f.label, text: fillTags(merged[f.key], tags) })),
  })
}
